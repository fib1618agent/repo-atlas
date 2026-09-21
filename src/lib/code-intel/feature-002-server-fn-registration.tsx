/**
 * AST + Symbol Intelligence (specs/002-ast-symbol-intelligence) has no
 * visitor-facing UI either, same posture as Feature 001. This null component
 * keeps all five server functions reachable over the deployed
 * `/_serverFn/<id>` HTTP surface for operator/future-feature use — research.md
 * §9 flags Feature 001 registering only 2 of its several server functions as
 * an observed gap; this file deliberately registers all five rather than
 * repeating that gap (contracts/symbol-query.functions.md).
 */
import { useServerFn } from "@tanstack/react-start";

import {
  extractSnapshotSymbols,
  getExtractionStatus,
  getFileExtraction,
  getSymbol,
  listSymbols,
} from "./symbol.functions";

export function Feature002ServerFnRegistration() {
  useServerFn(extractSnapshotSymbols);
  useServerFn(getExtractionStatus);
  useServerFn(listSymbols);
  useServerFn(getSymbol);
  useServerFn(getFileExtraction);
  return null;
}
