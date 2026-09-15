# RepoAtlas — Agent Notes

Standalone TanStack Start app. Do not rewrite published git history (no force-push, rebase, amend, or squash of commits that are already pushed).

## Commands

```bash
bun install          # install dependencies
bun run dev          # Vite + TanStack Start dev server
bun run build        # production build → .output/
./run.sh             # dev server on the first free port from 4949
bunx tsc --noEmit    # typecheck
```

## Conventions

- Conventional commits (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`).
- Keep the branch in a working state.
- Never commit `.env` or secrets. `.env.example` is the template.
