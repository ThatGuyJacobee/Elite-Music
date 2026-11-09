const dns = require("node:dns/promises");
const net = require("node:net");

const FETCH_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 256 * 1024;
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const BLOCKED_HOSTNAMES = new Set(["localhost"]);
const BLOCKED_HOST_SUFFIXES = [
    ".localhost",
    ".local",
    ".internal",
    ".intranet",
    ".lan",
    ".home",
    ".home.arpa",
    ".localdomain",
];
const DEFAULT_ACCEPT = "text/html,application/xhtml+xml,audio/*;q=0.9,video/*;q=0.9,*/*;q=0.8";
const USER_AGENT = "Elite-Music (https://github.com/ThatGuyJacobee/Elite-Music)";
const MEDIA_FILE_EXTENSION = /\.(?:mp3|m4a|aac|ogg|oga|opus|flac|wav|weba|webm|mp4)$/i;

const blockedAddresses = new net.BlockList();
blockedAddresses.addSubnet("0.0.0.0", 8, "ipv4");
blockedAddresses.addSubnet("10.0.0.0", 8, "ipv4");
blockedAddresses.addSubnet("100.64.0.0", 10, "ipv4");
blockedAddresses.addSubnet("127.0.0.0", 8, "ipv4");
blockedAddresses.addSubnet("169.254.0.0", 16, "ipv4");
blockedAddresses.addSubnet("172.16.0.0", 12, "ipv4");
blockedAddresses.addSubnet("192.0.0.0", 24, "ipv4");
blockedAddresses.addSubnet("192.0.2.0", 24, "ipv4");
blockedAddresses.addSubnet("192.168.0.0", 16, "ipv4");
blockedAddresses.addSubnet("198.18.0.0", 15, "ipv4");
blockedAddresses.addSubnet("198.51.100.0", 24, "ipv4");
blockedAddresses.addSubnet("203.0.113.0", 24, "ipv4");
blockedAddresses.addSubnet("224.0.0.0", 4, "ipv4");
blockedAddresses.addSubnet("240.0.0.0", 4, "ipv4");
blockedAddresses.addSubnet("::", 128, "ipv6");
blockedAddresses.addSubnet("::1", 128, "ipv6");
blockedAddresses.addSubnet("fc00::", 7, "ipv6");
blockedAddresses.addSubnet("fe80::", 10, "ipv6");
blockedAddresses.addSubnet("ff00::", 8, "ipv6");
blockedAddresses.addSubnet("2001:db8::", 32, "ipv6");

function parseHttpUrl(value) {
    try {
        const url = new URL(String(value));
        return url.protocol === "http:" || url.protocol === "https:" ? url : null;
    } catch {
        return null;
    }
}

function isHttpUrl(value) {
    return parseHttpUrl(value) !== null;
}

function normalizeHostname(hostname) {
    return String(hostname || "")
        .toLowerCase()
        .replace(/\.$/, "")
        .replace(/^\[|\]$/g, "");
}

function isPrivateAddress(address) {
    if (!address) return true;

    if (address.startsWith("::ffff:")) {
        const mapped = address.slice("::ffff:".length);
        if (net.isIPv4(mapped)) return isPrivateAddress(mapped);
    }

    if (net.isIPv4(address)) return blockedAddresses.check(address, "ipv4");
    if (net.isIPv6(address)) return blockedAddresses.check(address, "ipv6");

    return true;
}

async function isPublicHttpUrl(value) {
    const url = parseHttpUrl(value);
    if (!url || url.username || url.password) return false;

    const hostname = normalizeHostname(url.hostname);
    if (!hostname) return false;
    if (BLOCKED_HOSTNAMES.has(hostname)) return false;
    if (BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return false;

    if (net.isIP(hostname)) return !isPrivateAddress(hostname);

    let addresses;
    try {
        addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    } catch {
        return false;
    }

    return addresses.length > 0 && addresses.every(({ address }) => !isPrivateAddress(address));
}

async function fetchUrlSafe(value, options = {}) {
    const timeout = options.timeout ?? FETCH_TIMEOUT_MS;
    const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
    const accept = options.accept ?? DEFAULT_ACCEPT;
    const deadline = Date.now() + timeout;
    let url = parseHttpUrl(value);

    if (!url) throw new Error("Invalid URL");

    for (let redirects = 0; redirects <= maxRedirects; redirects++) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new Error("URL request timed out");
        if (!(await isPublicHttpUrl(url.href))) throw new Error("URL is not publicly reachable");

        const response = await fetch(url, {
            method: "GET",
            redirect: "manual",
            signal: AbortSignal.timeout(remaining),
            headers: {
                Accept: accept,
                "User-Agent": USER_AGENT,
            },
        });

        if (!REDIRECT_STATUS_CODES.has(response.status)) {
            return { response, url };
        }

        const location = response.headers.get("location");
        await response.body?.cancel().catch(() => null);
        if (!location) throw new Error("Redirect response without a location");

        url = new URL(location, url);
    }

    throw new Error("Too many redirects");
}

async function readBodyCapped(response, maxBytes = MAX_HTML_BYTES) {
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        await response.body?.cancel().catch(() => null);
        throw new Error("Response body is too large");
    }

    if (!response.body) return "";

    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;

    try {
        while (total < maxBytes) {
            const { done, value } = await reader.read();
            if (done) break;

            total += value.byteLength;
            if (total > maxBytes) {
                const allowed = value.byteLength - (total - maxBytes);
                chunks.push(Buffer.from(value.buffer, value.byteOffset, allowed));
                break;
            }

            chunks.push(Buffer.from(value));
        }
    } finally {
        await reader.cancel().catch(() => null);
    }

    return Buffer.concat(chunks).toString("utf8");
}

function responseContentType(response) {
    return String(response.headers.get("content-type") || "")
        .split(";")[0]
        .trim()
        .toLowerCase();
}

function isHtmlContentType(type) {
    return type === "text/html" || type === "application/xhtml+xml";
}

function isMediaContentType(type) {
    return (
        type.startsWith("audio/") ||
        type.startsWith("video/") ||
        type === "application/ogg" ||
        type === "application/octet-stream" ||
        type === "binary/octet-stream"
    );
}

function attachmentFilename(response) {
    const header = String(response.headers.get("content-disposition") || "");
    const encoded = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(header);
    const plain = /filename\s*=\s*(?:"([^"]+)"|([^;]+))/i.exec(header);
    const value = (encoded?.[1] ?? plain?.[1] ?? plain?.[2] ?? "").trim().replace(/^["']|["']$/g, "");

    if (!value) return "";

    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function hasMediaFilename(response) {
    return MEDIA_FILE_EXTENSION.test(attachmentFilename(response));
}

module.exports = {
    MAX_HTML_BYTES,
    attachmentFilename,
    fetchUrlSafe,
    hasMediaFilename,
    isHtmlContentType,
    isHttpUrl,
    isMediaContentType,
    isPublicHttpUrl,
    readBodyCapped,
    responseContentType,
};
