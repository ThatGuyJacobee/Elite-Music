const { Transform } = require("stream");

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2;
const BYTES_PER_FRAME = CHANNELS * BYTES_PER_SAMPLE;

// Applies a linear gain envelope to s16le stereo PCM before it reaches Discord's buffer.
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

    gainAtFrame(frame) {
        if (!this.fade) return 1;

        const progress = Math.max(0, Math.min(1, (frame - this.fade.startFrame) / this.fade.durationFrames));
        return this.fade.fromGain + (this.fade.toGain - this.fade.fromGain) * progress;
    }

    getCurrentGain() {
        return this.gainAtFrame(this.processedFrames);
    }

    scheduleFade(durationMs, fromGain, toGain) {
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
        this.fade = { durationFrames, endFrame, fromGain, startFrame, toGain };

        return {
            endMs: (endFrame / SAMPLE_RATE) * 1000,
            startMs: (startFrame / SAMPLE_RATE) * 1000,
        };
    }

    scheduleFadeOut(durationMs) {
        return this.scheduleFade(durationMs, this.getCurrentGain(), 0);
    }

    scheduleFadeIn(durationMs) {
        return this.scheduleFade(durationMs, 0, 1);
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
                    const gain = this.gainAtFrame(this.processedFrames + frameOffset);
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
