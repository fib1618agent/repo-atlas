import type { ArchiveEntry } from "../providers/content-provider";

/**
 * Dependency-free sequential ustar/GNU-tar parser over a byte stream (FR-017).
 * Tar is a sequence of fixed 512-byte header blocks + content blocks padded
 * to 512-byte boundaries — no seeking, no central directory. Handles headers
 * and content split across arbitrary input chunk boundaries by buffering
 * only up to the next needed byte count, never the whole archive (FR-015).
 *
 * Simplification (ponytail: buffers one entry's content fully before
 * emitting it, rather than sub-streaming each entry incrementally — real
 * per-entry incremental streaming is more complex for uncertain benefit at
 * foundation scope; still satisfies "never the full archive in memory,"
 * since only one entry is buffered at a time). Upgrade path: switch
 * `readExactly` to yield chunks progressively if a single file's size ever
 * approaches the 128 MB isolate ceiling.
 *
 * Only octal size fields are supported (covers files well under the GNU
 * base-256 threshold, i.e. everything under 8 GB) — acceptable for the
 * repositories this feature targets; base-256 large-file support is a
 * documented gap, not silently mishandled (throws on unparseable size).
 */

const BLOCK_SIZE = 512;

class ByteReader {
  private buffered: Uint8Array = new Uint8Array(0);
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private done = false;

  constructor(stream: ReadableStream<Uint8Array>) {
    this.reader = stream.getReader();
  }

  private async fill(minBytes: number): Promise<void> {
    while (this.buffered.length < minBytes && !this.done) {
      const { value, done } = await this.reader.read();
      if (done) {
        this.done = true;
        break;
      }
      const merged = new Uint8Array(this.buffered.length + value.length);
      merged.set(this.buffered, 0);
      merged.set(value, this.buffered.length);
      this.buffered = merged;
    }
  }

  /** Returns exactly `n` bytes, or fewer at true end-of-stream. */
  async readExactly(n: number): Promise<Uint8Array | null> {
    await this.fill(n);
    if (this.buffered.length === 0) return null;
    const take = Math.min(n, this.buffered.length);
    const out = this.buffered.slice(0, take);
    this.buffered = this.buffered.slice(take);
    return out;
  }
}

function readCString(
  bytes: Uint8Array,
  offset: number,
  length: number,
): string {
  const slice = bytes.slice(offset, offset + length);
  const nul = slice.indexOf(0);
  const trimmed = nul === -1 ? slice : slice.slice(0, nul);
  return new TextDecoder().decode(trimmed).trim();
}

function readOctalSize(
  bytes: Uint8Array,
  offset: number,
  length: number,
): number {
  const str = readCString(bytes, offset, length).trim();
  if (str === "") return 0;
  const parsed = parseInt(str, 8);
  if (Number.isNaN(parsed))
    throw new Error(`Unparseable tar size field: "${str}"`);
  return parsed;
}

function isZeroBlock(block: Uint8Array): boolean {
  for (const b of block) if (b !== 0) return false;
  return true;
}

function paddedSize(size: number): number {
  const remainder = size % BLOCK_SIZE;
  return remainder === 0 ? size : size + (BLOCK_SIZE - remainder);
}

function singleChunkStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

/** POSIX pax extended-header records (`typeflag` `x` / `g`). */
function parsePaxRecords(bytes: Uint8Array): Record<string, string> {
  const text = new TextDecoder().decode(bytes);
  const out: Record<string, string> = {};
  let offset = 0;
  while (offset < text.length) {
    const space = text.indexOf(" ", offset);
    if (space === -1) break;
    const len = Number.parseInt(text.slice(offset, space), 10);
    if (!Number.isFinite(len) || len <= 0) break;
    const record = text.slice(offset, offset + len);
    offset += len;
    const eq = record.indexOf("=");
    if (eq === -1) continue;
    const keyStart = record.indexOf(" ") + 1;
    const key = record.slice(keyStart, eq);
    const value = record.slice(eq + 1).replace(/\n$/, "");
    out[key] = value;
  }
  return out;
}

function ustarName(header: Uint8Array): string {
  const rawName = readCString(header, 0, 100);
  const prefix = readCString(header, 345, 155);
  return prefix ? `${prefix}/${rawName}` : rawName;
}

export function parseTarEntries(
  input: ReadableStream<Uint8Array>,
): ReadableStream<ArchiveEntry> {
  const byteReader = new ByteReader(input);
  let pendingLongName: string | null = null;
  let pendingFilePax: Record<string, string> | null = null;
  let globalPax: Record<string, string> = {};

  return new ReadableStream<ArchiveEntry>({
    async pull(controller) {
      for (;;) {
        const header = await byteReader.readExactly(BLOCK_SIZE);
        if (!header || header.length < BLOCK_SIZE || isZeroBlock(header)) {
          controller.close();
          return;
        }

        const typeflag = String.fromCharCode(header[156] ?? 0);
        let size = readOctalSize(header, 124, 12);

        if (typeflag === "x" || typeflag === "g" || typeflag === "L") {
          const metaContent =
            size > 0
              ? await byteReader.readExactly(paddedSize(size))
              : new Uint8Array(0);
          if (metaContent === null) {
            controller.close();
            return;
          }
          const metaBytes = metaContent.slice(0, size);
          if (typeflag === "x") {
            pendingFilePax = parsePaxRecords(metaBytes);
          } else if (typeflag === "g") {
            globalPax = { ...globalPax, ...parsePaxRecords(metaBytes) };
          } else {
            pendingLongName = readCString(metaBytes, 0, metaBytes.length);
          }
          continue;
        }

        let name = pendingLongName ?? ustarName(header);
        pendingLongName = null;

        const mergedPax = { ...globalPax, ...pendingFilePax };
        pendingFilePax = null;
        if (mergedPax["path"]) name = mergedPax["path"];
        if (mergedPax["size"]) {
          const parsed = Number.parseInt(mergedPax["size"], 10);
          if (!Number.isNaN(parsed)) size = parsed;
        }

        if (typeflag !== "0" && typeflag !== "\0") {
          if (size > 0) {
            const skipped = await byteReader.readExactly(paddedSize(size));
            if (skipped === null) {
              controller.close();
              return;
            }
          }
          continue;
        }
        if (!name) {
          if (size > 0) {
            await byteReader.readExactly(paddedSize(size));
          }
          continue;
        }

        const content =
          size > 0
            ? await byteReader.readExactly(paddedSize(size))
            : new Uint8Array(0);
        if (content === null) {
          controller.close();
          return;
        }
        const entryBytes = content.slice(0, size);

        controller.enqueue({
          path: name,
          size,
          content: singleChunkStream(entryBytes),
        });
        return;
      }
    },
  });
}
