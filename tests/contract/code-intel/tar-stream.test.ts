import { describe, expect, test } from "bun:test";
import { parseTarEntries } from "../../../src/lib/code-intel/acquisition/tar-stream";
import {
  buildTarBytes,
  buildTarBytesWithPaxPath,
  chunkedStream,
  readAllBytes,
} from "../../support/tar-fixture";

async function collectEntries(
  stream: ReadableStream<
    import("../../../src/lib/code-intel/providers/content-provider").ArchiveEntry
  >,
) {
  const reader = stream.getReader();
  const entries: { path: string; size: number; content: string }[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const bytes = await readAllBytes(value.content);
    entries.push({
      path: value.path,
      size: value.size,
      content: new TextDecoder().decode(bytes),
    });
  }
  return entries;
}

describe("tar-stream parser (FR-017)", () => {
  const files = [
    { name: "README.md", content: "hello world\n" },
    { name: "src/index.ts", content: "export const x = 1;\n".repeat(50) },
  ];

  test("parses entries when delivered as one large chunk", async () => {
    const bytes = buildTarBytes(files);
    const entries = await collectEntries(
      parseTarEntries(chunkedStream(bytes, bytes.length)),
    );
    expect(entries.map((e) => e.path)).toEqual(["README.md", "src/index.ts"]);
    expect(entries[0]!.content).toBe("hello world\n");
    expect(entries[1]!.content).toBe(files[1]!.content);
  });

  test("parses entries correctly when headers and content are split across small chunk boundaries", async () => {
    const bytes = buildTarBytes(files);
    // 37 is deliberately not a divisor of 512, forcing header/content splits at arbitrary offsets.
    const entries = await collectEntries(
      parseTarEntries(chunkedStream(bytes, 37)),
    );
    expect(entries.map((e) => e.path)).toEqual(["README.md", "src/index.ts"]);
    expect(entries[0]!.content).toBe("hello world\n");
    expect(entries[1]!.content).toBe(files[1]!.content);
  });

  test("parses entries correctly when delivered one byte at a time", async () => {
    const bytes = buildTarBytes(files);
    const entries = await collectEntries(
      parseTarEntries(chunkedStream(bytes, 1)),
    );
    expect(entries.map((e) => e.path)).toEqual(["README.md", "src/index.ts"]);
  });

  test("parses POSIX pax extended path records (typeflag x)", async () => {
    const longPath = "packages/nested/deep/and/wide/component-name.tsx";
    const bytes = buildTarBytesWithPaxPath(longPath, "pax-body\n");
    const entries = await collectEntries(
      parseTarEntries(chunkedStream(bytes, 64)),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]!.path).toBe(longPath);
    expect(entries[0]!.content).toBe("pax-body\n");
  });

  test("empty archive (just end markers) yields zero entries", async () => {
    const bytes = buildTarBytes([]);
    const entries = await collectEntries(
      parseTarEntries(chunkedStream(bytes, 512)),
    );
    expect(entries).toEqual([]);
  });
});
