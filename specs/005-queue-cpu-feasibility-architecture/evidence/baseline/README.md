# Protected-path baseline — Feature 005, task T002

Created by task T002 on 2026-09-23. It records the working-tree state at the time T002 ran, so later tasks (T029, T046) can detect drift. Nothing in the repository was cleaned, reset, stashed, checked out, committed or otherwise modified to produce it. All commands below are read-only on the repository; they write only under `specs/005-queue-cpu-feasibility-architecture/evidence/baseline/`.

## Files in this directory

| File | Content | Enforced? |
|---|---|---|
| `state.txt` | timestamp, git HEAD, branch, staged changes, full `git status --short` at T002 time | record |
| `set-A-files.txt` | **Set A** exact sorted file list (148 files), tracked + untracked | **enforced** |
| `set-A.sha256` | SHA-256 of every Set A file (`shasum -a 256`) | **enforced** |
| `set-B.sha256` | SHA-256 of the two Query-cache experiment files (**Set B**) | **enforced** (same as A) |
| `set-B.patch` | saved diffs of the Set B files | **enforced** (same as A) |
| `set-C-recorded.txt` | **Set C**: every other dirty/untracked path (33 entries; `status<TAB>path`) | informational only, never a stop |
| `tsc-baseline.txt` | `bunx tsc --noEmit` exit code and full output at T002 time | comparison baseline for T047 |
| `README.md` | this file | — |

## The three sets

- **Set A — ENFORCED.** Roots: `specs/001-code-intelligence-foundation` (Feature 001, code-intel foundation), `specs/002-ast-symbol-intelligence`, `specs/004-engineering-relationship-graph`; documentation-only protection for the two other spec directories `specs/001-dynamic-github-sources` (a different, earlier feature that shares the 001 prefix) and `specs/003-github-source-enhancement`; `src/lib/code-intel/**` (excluding Set B files); `plugins/`; `scripts/relationship-*.ts` (by name); code-intel tests (`tests/contract/symbols/**`, `tests/integration/symbols/**`, plus any test file found by `grep -rl "code-intel" tests`); and the named execution-surface files `nitro.config.ts`, `wrangler.toml`, `data/code-intel-schema.sql`, `package.json`, `tsconfig.json`, `bun.lock`, `bunfig.toml`, `.specify/feature.json` (this last one is git-ignored, so it is included by name whenever it exists). Feature 003 / dynamic-sources *implementation* files (atlas UI and GitHub-source data layer) are deliberately not in Set A: they land in Set C.
- **Set B — QUERY-CACHE experiment** (tracked separately, enforced exactly like Set A; membership is fixed here and not reshuffled by the later hunk classification in T029): `src/lib/code-intel/symbols/to-intermediate-representation.ts` (tracked file with uncommitted changes) and `scripts/query-cold-start-experiment.ts` (untracked). The Query-cache association of the script is confirmed or corrected in task T029. `src/lib/code-intel/config.ts` is Feature 004 scaffolding and stays in Set A.
- **Set C — UNRELATED / other dirty state** (recorded, never enforced): every dirty, untracked or staged path from git that is not in Set A or Set B (UI routes, `routeTree.gen.ts`, non-code-intel tests, docs, and this workstream's own output under `specs/005-queue-cpu-feasibility-architecture/`).

## Untracked files

Plain `git diff` shows nothing for untracked files. Untracked files in Set A/B are therefore covered by (1) the file list and (2) a SHA-256 in the `.sha256` file; for Set B the saved patch is produced with `git diff --no-index -- /dev/null <file>` (exit status 1 means "differs" and is expected). `shasum -c` alone is not sufficient because it cannot detect files that were added.

## Exact commands (the script used to generate the files)

Save as a script (for example `/tmp/t002_baseline.sh`) and run `t002_baseline.sh <command>` from anywhere inside the repository. `list-A`, `hash-A`, `hash-B`, `patch-B`, `list-C` produced `set-A-files.txt`, `set-A.sha256`, `set-B.sha256`, `set-B.patch`, `set-C-recorded.txt` respectively (`state.txt` and `tsc-baseline.txt` were produced by the two commands below the script).

```bash
#!/usr/bin/env bash
# Feature 005 T002 baseline commands. Read-only on the repository; writes only to the paths given by the caller.
# Usage: t002_baseline.sh <command>
#   list-A     sorted Set A file list (existing files only) to stdout
#   hash-A     SHA-256 lines ("hash  path") for Set A to stdout
#   list-B     Set B file list to stdout
#   hash-B     SHA-256 lines for Set B to stdout
#   patch-B    saved diffs for Set B to stdout
#   list-C     Set C record ("status<TAB>path") to stdout
set -u
export LC_ALL=C
cd "$(git rev-parse --show-toplevel)" || exit 2

G="git -c core.quotepath=off --no-pager"

setB_files() {
  printf '%s\n' \
    scripts/query-cold-start-experiment.ts \
    src/lib/code-intel/symbols/to-intermediate-representation.ts | sort
}

setA_candidates() {
  {
    # tracked + untracked (not ignored) files in the protected roots
    $G ls-files -- \
      specs/001-code-intelligence-foundation \
      specs/001-dynamic-github-sources \
      specs/002-ast-symbol-intelligence \
      specs/003-github-source-enhancement \
      specs/004-engineering-relationship-graph \
      src/lib/code-intel \
      plugins \
      nitro.config.ts wrangler.toml data/code-intel-schema.sql \
      'scripts/relationship-*.ts' \
      tests/contract/symbols tests/integration/symbols \
      package.json tsconfig.json bun.lock bunfig.toml .specify/feature.json
    $G ls-files --others --exclude-standard -- \
      specs/001-code-intelligence-foundation \
      specs/001-dynamic-github-sources \
      specs/002-ast-symbol-intelligence \
      specs/003-github-source-enhancement \
      specs/004-engineering-relationship-graph \
      src/lib/code-intel \
      plugins \
      nitro.config.ts wrangler.toml data/code-intel-schema.sql \
      'scripts/relationship-*.ts' \
      tests/contract/symbols tests/integration/symbols \
      package.json tsconfig.json bun.lock bunfig.toml .specify/feature.json
    # explicitly named execution-surface files, included whenever they exist (even if git-ignored)
    printf '%s\n' nitro.config.ts wrangler.toml data/code-intel-schema.sql package.json tsconfig.json bun.lock bunfig.toml .specify/feature.json
    # any other test file that references code-intel (working tree, includes untracked)
    grep -rl "code-intel" tests 2>/dev/null
  } | sort -u
}

list_A() {
  # existing files only; Set B files are excluded from Set A
  setA_candidates | while IFS= read -r f; do [ -f "$f" ] && printf '%s\n' "$f"; done | sort -u \
    | comm -23 - <(setB_files)
}

hash_files() {
  while IFS= read -r f; do shasum -a 256 -- "$f"; done
}

patch_B() {
  setB_files | while IFS= read -r f; do
    echo "##### $f"
    if $G ls-files --error-unmatch -- "$f" >/dev/null 2>&1; then
      $G diff --no-color --no-ext-diff -- "$f"
    else
      # untracked: plain `git diff` shows nothing; exit status 1 means "differs" and is expected
      $G diff --no-color --no-ext-diff --no-index -- /dev/null "$f" || true
    fi
  done
}

list_C() {
  # every other dirty / untracked / staged path, excluding Set A and Set B members
  {
    $G ls-files -m | sed 's/^/ M\t/'
    $G ls-files -d | sed 's/^/ D\t/'
    $G ls-files --others --exclude-standard | sed 's/^/??\t/'
    $G diff --cached --name-only | sed 's/^/S \t/'
  } | sort -t "$(printf '\t')" -k2,2 -u > /tmp/t002_C_all.$$
  { list_A; setB_files; } | sort -u > /tmp/t002_AB.$$
  awk -F '\t' 'NR==FNR{ab[$0]=1; next} !($2 in ab)' /tmp/t002_AB.$$ /tmp/t002_C_all.$$
  rm -f /tmp/t002_C_all.$$ /tmp/t002_AB.$$
}

case "${1:-}" in
  list-A)  list_A ;;
  hash-A)  list_A | hash_files ;;
  list-B)  setB_files ;;
  hash-B)  setB_files | hash_files ;;
  patch-B) patch_B ;;
  list-C)  list_C ;;
  *) echo "usage: $0 {list-A|hash-A|list-B|hash-B|patch-B|list-C}" >&2; exit 2 ;;
esac
```

`state.txt` was produced with:

```bash
{ echo "timestamp: $(date '+%Y-%m-%d %H:%M:%S %Z (UTC%z)')"; echo "git HEAD: $(git rev-parse HEAD)"; echo "branch: $(git rev-parse --abbrev-ref HEAD)"; echo "staged changes (git diff --cached --name-status):"; git diff --cached --name-status; echo "--- git status --short (full output, including untracked) ---"; git status --short; } > state.txt
```

`tsc-baseline.txt` was produced with `bunx tsc --noEmit > out 2>&1; echo $?` (exit code and full output recorded verbatim; `tsc` runs with `noEmit` and writes no build output).

## Verification procedure (used by task T046)

Run from the repository root with the script above (`S=/tmp/t002_baseline.sh`; `B=specs/005-queue-cpu-feasibility-architecture/evidence/baseline`):

```bash
# Set A: additions and deletions (list diff), then modifications (hash check)
$S list-A | diff - $B/set-A-files.txt          # any output = files added or removed
$S hash-A | diff - $B/set-A.sha256             # any output = files modified (or list changed)
# Set B: hashes and saved diffs, regenerated with the same commands
$S hash-B | diff - $B/set-B.sha256
$S patch-B | diff - $B/set-B.patch
# Set C: informational only (report differences; never a stop)
$S list-C | diff - $B/set-C-recorded.txt
```

Any Set A or Set B difference stops task T046 (gate S4): report the exact paths, do not revert. Files under `specs/005-queue-cpu-feasibility-architecture/` are not in Set A/B and are allowed to change; the three project logs appended in T048 are outside the sets as well.
