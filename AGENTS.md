# RepoAtlas — Agent Notes

Standalone TanStack Start app. Do not rewrite published git history (no force-push, rebase, amend, or squash of commits that are already pushed).

## Commands

```bash
bun install          # install dependencies
bun run dev          # Vite + TanStack Start dev server
bun run build        # production build → .output/
./run.sh             # dev server on the first free port from 4949
bunx tsc --noEmit    # typecheck
bun run db:init      # create data/atlas.sqlite from schema
bun run db:export    # dump cached repos to data/atlas-export.json
bun run db:reset     # ATLAS_DB_RESET=1 bun run db:reset
```

## Conventions

- Conventional commits (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`).
- Keep the branch in a working state.
- Never commit `.env` or secrets. `.env.example` is the template.
