/**
 * Feature 001 (Code Intelligence Foundation) has no visitor-facing UI. TanStack
 * Start only emits `/_serverFn/<id>` RPCs for `createServerFn` exports that are
 * reachable from the client module graph — see `use-atlas-repositories.ts`
 * (`getRepositories`) and `RepositoryPanel.tsx` (`getAISummary`).
 *
 * This null component keeps `acquireSnapshot` / `getSnapshotStatus` in that
 * graph for operator HTTP smoke tests; it does not call them at runtime.
 */
import { useServerFn } from "@tanstack/react-start";

import { acquireSnapshot, getSnapshotStatus } from "./snapshot.functions";

export function Feature001ServerFnRegistration() {
  useServerFn(acquireSnapshot);
  useServerFn(getSnapshotStatus);
  return null;
}
