import { buildTarBytes } from "./tar-fixture";

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export type FakeRepoFile = { name: string; content: string };

/**
 * Installs a `globalThis.fetch` stand-in that serves a fixed commit SHA for
 * `resolveRef` and a real gzip'd tar archive (built from `files`) for
 * `fetchArchive`, so `acquireSnapshot` → queue processing can run end-to-end
 * without a live GitHub network call.
 */
export type FakeGithubOptions = {
  /** Simulates GitHub codeload's `{repo}-{sha}/` tarball root directory. */
  archiveRootPrefix?: string;
};

export async function installFakeGithub(
  sha: string,
  files: FakeRepoFile[],
  options?: FakeGithubOptions,
): Promise<() => void> {
  const original = globalThis.fetch;
  const tarBytes = options?.archiveRootPrefix
    ? buildTarBytes(
        files.map((f) => ({
          name: `${options.archiveRootPrefix}/${f.name}`,
          content: f.content,
        })),
      )
    : buildTarBytes(files);
  const gzipped = await gzip(tarBytes);

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    if (url.includes("/commits/")) {
      return new Response(sha, { status: 200 });
    }
    if (url.includes("codeload.github.com") && url.includes("/tar.gz/")) {
      return new Response(new Blob([gzipped as BlobPart]), { status: 200 });
    }
    if (url.includes("/compare/")) {
      return new Response(JSON.stringify({ files: [] }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  return () => {
    globalThis.fetch = original;
  };
}
