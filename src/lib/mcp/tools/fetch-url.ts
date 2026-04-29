import { isIP } from "net";
import { lookup } from "dns/promises";

const MAX_REDIRECTS = 3;
const MAX_CONTENT_BYTES = 1_000_000;
const FETCH_TIMEOUT_MS = 10_000;

const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal"]);

function isBlockedIp(address: string): boolean {
  const normalized = address.toLowerCase();
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mappedIpv4) return isBlockedIp(mappedIpv4);

  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80:")) return true;

  const parts = normalized.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

async function assertPublicHttpUrl(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only HTTP and HTTPS URLs can be indexed");
  }

  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("Only HTTPS URLs can be indexed in production");
  }

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".localhost")) {
    throw new Error("URL host is not allowed");
  }

  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new Error("URL IP address is not allowed");
    return;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new Error("URL host could not be resolved");
  }

  if (addresses.some(({ address }) => isBlockedIp(address))) {
    throw new Error("URL resolves to a private or reserved address");
  }
}

async function readLimitedText(response: Response): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_CONTENT_BYTES) {
    throw new Error(`URL content is too large (max ${MAX_CONTENT_BYTES} bytes)`);
  }

  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const chunks: Uint8Array[] = [];
  let bytesRead = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;

    bytesRead += value.byteLength;
    if (bytesRead > MAX_CONTENT_BYTES) {
      await reader.cancel();
      throw new Error(`URL content is too large (max ${MAX_CONTENT_BYTES} bytes)`);
    }
    chunks.push(value);
  }

  const body = new Uint8Array(bytesRead);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(body);
}

export async function fetchPublicUrl(url: string): Promise<{
  finalUrl: string;
  contentType: string;
  text: string;
}> {
  let currentUrl = new URL(url);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    await assertPublicHttpUrl(currentUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(currentUrl, {
        redirect: "manual",
        signal: controller.signal,
      });

      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.has("location")
      ) {
        if (redirectCount === MAX_REDIRECTS) {
          throw new Error("Too many redirects while fetching URL");
        }
        currentUrl = new URL(response.headers.get("location")!, currentUrl);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (
        contentType &&
        !contentType.includes("text/") &&
        !contentType.includes("application/json") &&
        !contentType.includes("application/xml") &&
        !contentType.includes("application/xhtml+xml")
      ) {
        throw new Error(`Unsupported content type: ${contentType}`);
      }

      return {
        finalUrl: currentUrl.toString(),
        contentType,
        text: await readLimitedText(response),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Too many redirects while fetching URL");
}
