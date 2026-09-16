# Contract: Sources dialog UI

Component: `src/components/atlas/SourcesDialog.tsx`  
Mount: single instance in `src/routes/__root.tsx`; open via `sources-store.setDialogOpen(true)`.

## Entry points

1. Header `Add sources` (all atlas chrome pages)
2. Explore hero `Load GitHub users`
3. Sources chip on catalogue/categories/insights when `!isDefault`

## Dialog copy (exact)

| Element | Text |
|---------|------|
| Title | Add GitHub sources |
| Description | Paste GitHub user, organization, or repository URLs. Only public repositories are loaded. The default atlas stays until you click Load. |
| Placeholder | https://github.com/username |
| Add more | Add more |
| Add more disabled | Maximum 5 GitHub URLs. |
| Load | Load / Loading… |
| Cancel | Cancel |
| Reset | Reset to default |
| Reset confirm title | Restore the default atlas? |
| Reset confirm body | This clears your custom GitHub sources and shows imdadareeph repositories again. |
| Reset confirm OK | Restore default |
| Reset confirm cancel | Keep current |

## Behavior

- Prefill first row with `https://github.com/imdadareeph` when `isDefault`; else last successful `urls`
- Min 1 row; minus hidden when only one row
- Load disabled while fetching; label `Loading…` with spinner (FR-021)
- Cancel/close does not persist draft
- Reset clears `localStorage` + invalidates query
- Success closes dialog + success toast

## Explore refetch (FR-021)

While `isFetching` and prior `repositories.length > 0` on `/`:

- Keep `AtlasScene` mounted (do not swap canvas to empty state).
- Show existing `AtlasLoading` overlay above the scene.
- TanStack Query: `placeholderData: keepPreviousData` (see `get-repositories.md`).

## Export control

- Label: `Export JSON`
- Adjacent to Add sources in header
- See `export-json.md`

## Sources chip (custom atlas)

```text
Sources: {loginA} + {loginB}
```

Click opens dialog.

## Toasts (success)

| Event | Message |
|-------|---------|
| Custom load | Loaded {n} public repositories from {k} source(s). |
| Reset | Restored the default atlas. |
| Duplicate removed | Removed duplicate: {login} |
| Spiral truncate | Showing 800 of {n} repositories in the atlas (sorted by stars). Catalogue lists all loaded repos. |
| Catalogue truncate | Loaded the 2000 most-starred repositories across your sources. |
| Export | Exported {n} repositories. |
