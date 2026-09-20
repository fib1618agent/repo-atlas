const BLOCK_SIZE = 512;

function pad(bytes: Uint8Array, blockSize: number): Uint8Array {
  const remainder = bytes.length % blockSize;
  if (remainder === 0) return bytes;
  const padded = new Uint8Array(bytes.length + (blockSize - remainder));
  padded.set(bytes, 0);
  return padded;
}

function writeString(block: Uint8Array, offset: number, value: string): void {
  const encoded = new TextEncoder().encode(value);
  block.set(encoded.slice(0, block.length - offset), offset);
}

function writeOctal(
  block: Uint8Array,
  offset: number,
  length: number,
  value: number,
): void {
  const octal = value.toString(8).padStart(length - 1, "0");
  writeString(block, offset, octal);
}

export function buildPaxTarLine(key: string, value: string): string {
  let len = 10;
  for (;;) {
    const record = `${len} ${key}=${value}\n`;
    if (record.length === len) return record;
    len = record.length;
  }
}

/** Tar with a POSIX pax `path` record (GitHub-style long paths). */
export function buildTarBytesWithPaxPath(
  path: string,
  content: string,
): Uint8Array {
  const paxBody = new TextEncoder().encode(buildPaxTarLine("path", path));
  const parts: Uint8Array[] = [];

  const xHeader = new Uint8Array(BLOCK_SIZE);
  writeString(xHeader, 0, "././@PaxHeader");
  writeOctal(xHeader, 124, 12, paxBody.length);
  xHeader[156] = "x".charCodeAt(0);
  parts.push(xHeader);
  parts.push(pad(paxBody, BLOCK_SIZE));

  const fHeader = new Uint8Array(BLOCK_SIZE);
  writeString(fHeader, 0, "truncated");
  writeOctal(fHeader, 124, 12, content.length);
  fHeader[156] = "0".charCodeAt(0);
  parts.push(fHeader);
  parts.push(pad(new TextEncoder().encode(content), BLOCK_SIZE));
  parts.push(new Uint8Array(BLOCK_SIZE));
  parts.push(new Uint8Array(BLOCK_SIZE));

  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function buildTarBytesWithRootPrefix(
  files: { name: string; content: string }[],
  rootPrefix: string,
): Uint8Array {
  return buildTarBytes(
    files.map((f) => ({
      name: `${rootPrefix}/${f.name}`,
      content: f.content,
    })),
  );
}

/** Minimal ustar builder for tests — not a general-purpose tar writer. */
export function buildTarBytes(
  files: { name: string; content: string }[],
): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const file of files) {
    const header = new Uint8Array(BLOCK_SIZE);
    writeString(header, 0, file.name);
    writeOctal(header, 124, 12, file.content.length);
    header[156] = "0".charCodeAt(0); // typeflag: regular file
    parts.push(header);
    parts.push(pad(new TextEncoder().encode(file.content), BLOCK_SIZE));
  }
  parts.push(new Uint8Array(BLOCK_SIZE)); // end-of-archive marker (two zero blocks)
  parts.push(new Uint8Array(BLOCK_SIZE));

  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** Splits bytes into a ReadableStream delivered in fixed-size chunks — used to force headers/content to split across arbitrary chunk boundaries. */
export function chunkedStream(
  bytes: Uint8Array,
  chunkSize: number,
): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      const end = Math.min(offset + chunkSize, bytes.length);
      controller.enqueue(bytes.slice(offset, end));
      offset = end;
    },
  });
}

export async function readAllBytes(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
