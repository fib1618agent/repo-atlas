# Contract: Live-Experiment Proposal Template

> This file is the *template*. The instance produced by the tasks is `specs/005-queue-cpu-feasibility-architecture/live-experiment-proposal.md`, and it stays `NOT AUTHORIZED` unless and until the user authorizes that specific experiment.

A proposal is a document. Drafting it authorizes nothing. Every instance MUST carry the banner below until the user explicitly authorizes **that specific experiment** (FR-036). No blanket authorization exists.

```
STATUS: NOT AUTHORIZED
Authorization ref: (none)
```

## Required fields
1. **ID and question answered** — which UNKNOWN(s) (U1–U5) or measurement (M5–M7) it resolves.
2. **Preconditions** — offline steps completed first (e.g., read Observability query/telemetry-key docs, previously unread per observability report §16); local suite green; working tree state recorded.
3. **Resources touched** — exact Worker(s), queue(s), snapshot(s); nothing else. Minimal: smallest already-acquired snapshot; one tiny unit, then optionally one larger unit.
4. **Exact steps** — ordered, each stating the command class (e.g., config change + deploy, trigger extraction, read log) and whether it is a deployment. Note: enabling Workers Logs/observability is a configuration change and redeploy, i.e. a deployment.
5. **Expected observations** — fields to record: `$workers.cpuTimeMs`, `$workers.outcome`, timestamp, invocation type; correlation to known file count/sizes via D1 records.
6. **Reversal steps** — how each change is undone (disable observability, redeploy prior config, delete test rows/messages) and how cleanup is verified.
7. **Failure handling** — if any change cannot be reverted or cleanup fails: state what remains changed, stop, and require explicit user direction before further live action.
8. **Cost/limit impact** — Queue operations consumed (10,000/day free cap), D1/R2 usage; confirm no paid service.
9. **Post-execution log** — filled afterward: what changed, what was reverted, results with sample size, cold/warm, unit (per [measurement-protocol.md](./measurement-protocol.md)).

## Rules
- Documented before execution; minimal; reversible; limited to required resources; cleanup-followed (FR-036).
- The user authorization must name the experiment id; a general "proceed" does not qualify.
- Results from an authorized run become PLATFORM-TELEMETRY evidence only with recorded scope and inclusions.
- Feasibility of running on Free is UNKNOWN (U3); a proposal that fails to observe queue CPU is still a valid outcome and leaves Feature 004 T007 STOPPED.
