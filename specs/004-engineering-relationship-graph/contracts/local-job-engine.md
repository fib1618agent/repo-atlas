# Contract: Local Durable Job Engine (A6 / ADR-001)

**Added 2026-09-25 (architecture revision; D-ARCH-1 places the job engine in Feature 004). Documentation contract only — nothing here is implemented, and implementation is NOT authorized until the redefined T007 (research.md A6) passes review.**

Replaces the Cloudflare `RELATIONSHIP_QUEUE` consumer as the **core** execution substrate for deep graphification (relationship extraction now; later process/impact stages reuse it). The Cloudflare Queue contract in `extract-relationships.functions.md` remains as the optional deployment-adapter variant (D-ARCH-4).

## Job model

Persisted in SQLite (additive tables, exact schema a planning output of the redefined T007):

```text
job:
  id                 stable identifier
  kind               e.g. relationship-extraction unit ('contains' | 'parsed'), later stages
  repository_id      canonical repository (ADR-001 §5.4)
  snapshot_id        Feature 001 snapshot scope
  unit_ref           e.g. file path for a 'parsed' unit
  state              PENDING | CLAIMED | RUNNING | COMPLETED | FAILED | RETRYING | SKIPPED
  attempts           retry counter (bounded by policy)
  checkpoint         resumability marker (mirrors Feature 002 ExtractionJob checkpointing)
  claimed_by / claimed_at / updated_at
  error              typed error on FAILED (no raw stack traces in any surfaced response)
```

## State machine

```text
PENDING → CLAIMED → RUNNING → COMPLETED
                        │
                        ├→ FAILED (attempts exhausted or non-retryable)
                        ├→ RETRYING → PENDING (bounded backoff)
                        └→ SKIPPED (policy exclusion, e.g. oversized file per file-size policy)
```

## Guarantees (normative)

1. **Durability / crash recovery**: job state survives process death; a stale `CLAIMED`/`RUNNING` claim is reclaimable after a lease timeout; no job is lost or silently duplicated.
2. **Idempotency**: re-executing a unit at an unchanged extractor version yields the identical persisted result (FR-009 unchanged); COMPLETED units short-circuit.
3. **Bounded concurrency**: worker parallelism ≤ `ATLAS_MAX_CONCURRENT_ANALYSES`; queued deep analyses ≤ `ATLAS_MAX_QUEUED_ANALYSES` (ADR-001 §5.3).
4. **Repository scoping**: every job carries its repository/snapshot scope; pause/cancel operates per repository and is explicit — nothing is auto-evicted.
5. **Ordering**: `contains` units before `parsed` units within a snapshot (research.md §4 unchanged).
6. **Failure containment**: a file-scoped failure marks that unit FAILED/RETRYING without aborting the snapshot's other units (FR-008 unchanged).
7. **Lifecycle projection**: repository lifecycle states (ADR-001 §5.2: QUEUED/ANALYZING/GRAPHIFIED/FAILED/PAUSED) are projections over these job states; the engine emits enough state to compute them with no extra bookkeeping store.
8. **Purge**: purging a repository (Feature 003 amendment A1) deletes its queued/failed jobs along with its intelligence artifacts.

## Non-goals

No distributed workers, no external broker (Redis/Kafka/RabbitMQ prohibited by ADR-001 §1), no cron/watcher auto-enqueue (graphification starts from explicit user selection), no priority classes until evidence demands them.
