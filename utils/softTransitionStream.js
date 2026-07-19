const { Transform } = require("stream");

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2;
const BYTES_PER_FRAME = CHANNELS * BYTES_PER_SAMPLE;

class SoftTransitionStream extends Transform {
    constructor() {
        super();
        this.fade = null;
        this.processedFrames = 0;
        this.remainder = Buffer.alloc(0);
    }

    get processedMs() {
        return (this.processedFrames / SAMPLE_RATE) * 1000;
    }

    scheduleFadeOut(durationMs) {
        if (
            !Number.isFinite(durationMs) ||
            durationMs <= 0 ||
            this.destroyed ||
            this.readableEnded ||
            this.writableEnded
        ) {
            return null;
        }

        const durationFrames = Math.max(1, Math.round((durationMs / 1000) * SAMPLE_RATE));
        const startFrame = this.processedFrames;
        const endFrame = startFrame + durationFrames;
        this.fade = { durationFrames, endFrame, startFrame };

        return {
            endMs: (endFrame / SAMPLE_RATE) * 1000,
            startMs: (startFrame / SAMPLE_RATE) * 1000,
        };
    }

    cancelFade() {
        this.fade = null;
    }

    _transform(chunk, encoding, callback) {
        try {
            const source = this.remainder.length > 0 ? Buffer.concat([this.remainder, chunk]) : chunk;
            const processableLength = source.length - (source.length % BYTES_PER_FRAME);
            this.remainder =
                processableLength === source.length ? Buffer.alloc(0) : Buffer.from(source.subarray(processableLength));

            if (processableLength === 0) return callback();

            const output = Buffer.from(source.subarray(0, processableLength));
            const frameCount = processableLength / BYTES_PER_FRAME;

            if (this.fade) {
                for (let frameOffset = 0; frameOffset < frameCount; frameOffset += 1) {
                    const frame = this.processedFrames + frameOffset;
                    const progress = Math.max(
                        0,
                        Math.min(1, (frame - this.fade.startFrame) / this.fade.durationFrames),
                    );
                    const gain = 1 - progress;
                    const byteOffset = frameOffset * BYTES_PER_FRAME;

                    for (let channel = 0; channel < CHANNELS; channel += 1) {
                        const sampleOffset = byteOffset + channel * BYTES_PER_SAMPLE;
                        const sample = output.readInt16LE(sampleOffset);
                        output.writeInt16LE(Math.round(sample * gain), sampleOffset);
                    }
                }
            }

            this.processedFrames += frameCount;
            this.push(output);
            callback();
        } catch (error) {
            callback(error);
        }
    }

    _flush(callback) {
        if (this.remainder.length > 0) this.push(this.remainder);
        this.remainder = Buffer.alloc(0);
        callback();
    }
}

module.exports = { SoftTransitionStream };
