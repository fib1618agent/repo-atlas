# Contract: symbol query server functions

`src/lib/code-intel/symbol.functions.ts` (same module as `extractSnapshotSymbols`). All three functions below are registered in the client module graph (`useServerFn`, mirroring `feature-001-server-fn-registration.tsx`) so they are reachable over the deployed `/_serverFn/<id>` HTTP surface — see `research.md` §9 for why this is a deliberate correction to Feature 001's observed registration gap, not an incidental choice.

## `listSymbols`

```ts
export const listSymbols = createServerFn({ method: "POST" })
  .validator(
    (data: {
      snapshotId: number;
      kind?: "module" | "class" | "interface" | "function" | "method" | undefined;
      directoryPath?: string | undefined;
      cursor?: number | undefined;
      limit?: number | undefined;
    }) => data,
  )
  .handler(async ({ data }): Promise<SymbolsPage> => { ... });

type SymbolsPage = {
  symbols: {
    id: number;
    kind: string;
    name: string;
    qualifiedName: string | null;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
    parentSymbolId: number | null;
  }[];
  nextCursor: number | null;
};
```

1. **Given** a snapshot with completed (or partially completed) extraction, **When** `listSymbols` is called, **Then** results are paginated (bounded `limit`, cursor-based, mirroring `listSnapshotFiles`) and never exceed the configured max page size (FR-024).
2. **Given** `kind` is supplied, **When** called, **Then** only symbols of that kind are returned.
3. **Given** `directoryPath` is supplied, **When** called, **Then** only symbols whose file falls under that directory (or its descendants) are returned.
4. **Given** a snapshot with no `snapshot_extractions` row (extraction never run), **When** called, **Then** an empty page is returned (`{ symbols: [], nextCursor: null }`) — never throws, mirroring Feature 001's `listSnapshotFiles` FR-009 "never throws" precedent.

## `getSymbol`

```ts
export const getSymbol = createServerFn({ method: "POST" })
  .validator((data: { symbolId: number }) => data)
  .handler(async ({ data }): Promise<SymbolDetail> => { ... });

type SymbolDetail = {
  id: number;
  kind: string;
  name: string;
  qualifiedName: string | null;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  parentSymbolId: number | null;
  isExported: boolean | null;
  provenance: {
    filePath: string;
    snapshotId: number;
    repository: { provider: "github" | "gitlab"; owner: string; name: string };
    commitSha: string;
  };
};
```

1. **Given** a valid `symbolId`, **When** called, **Then** the full provenance chain (file → snapshot → repository → commit SHA, FR-023) is resolved and returned in this one call, with no further lookup required by the caller.
2. **Given** a `symbolId` that does not exist, **When** called, **Then** the function throws a serialized `AtlasError` with code `SYMBOL_NOT_FOUND`.

## `getFileExtraction`

```ts
export const getFileExtraction = createServerFn({ method: "POST" })
  .validator((data: { snapshotId: number; path: string }) => data)
  .handler(async ({ data }): Promise<FileExtractionDetail> => { ... });

type FileExtractionDetail = {
  path: string;
  language: string | null;
  status: "not_attempted" | "extracted" | "skipped_unsupported" | "failed";
  failureReason: string | null;
  extractorVersion: string | null;
  symbolCount: number;
};
```

1. **Given** a `(snapshotId, path)` pair with no `file_extractions` row yet (unit not yet processed, or extraction never run), **When** called, **Then** `status: "not_attempted"` is returned — never throws (User Story 3, FR-017's "never silently omitting a file" requirement extends to this query surface too: an unprocessed file is explicitly reported as such, not indistinguishable from a 404).

## Errors

| Code | When |
|---|---|
| `SYMBOL_NOT_FOUND` | `getSymbol` called with an unknown `symbolId` |

New code is an additive member of `AtlasErrorCode`, alongside `SNAPSHOT_NOT_EXTRACTABLE` (see `extract-symbols.functions.md`).
