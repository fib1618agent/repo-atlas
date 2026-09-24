# Contract: Telemetry-Default Waiver (FR-038)

> This file is the *template/contract*. A waiver record exists only if the user explicitly grants one; none exists at this point in the workstream. A later waiver is recorded as a waiver file plus an Appendix C revision entry in the decision record (see `contracts/decision-record.md`).

No waiver exists. This is the only form one may take. A waiver is an explicit user decision; it is never drafted-and-assumed by Claude.

## Required fields
- **Gate condition waived**: the FR-028 letter (a–e) and its wording.
- **Reasoning and evidence relied on**: EvidenceRecord ids; must not rest on LOCAL-WALLCLOCK alone or on silence.
- **Residual risk accepted**: concrete failure (e.g., queue consumer terminated for CPU; batch retried; extraction not completing on Free).
- **Withdrawal conditions**: contrary platform evidence, doc change, observed overrun, owner decision.
- **If the waiver touches the CPU budget** (gate condition (b), or the selection rule for a processing unit under FR-007/FR-038): it MUST explicitly name (i) the **assumed CPU budget X** (value and unit, and that it is an assumption, not established evidence), (ii) the **safety margin M**, and (iii) the **selected processing unit** it applies to. A budget-related waiver that omits any of the three is invalid.
- **Granted by / date / status** (`active` | `withdrawn`).

## Rules
- Invalid if inferred from silence, from a general instruction to proceed, or from local measurements.
- If later evidence contradicts the reasoning, the waiver goes back to review and Feature 004 T007 returns to STOPPED until the owner confirms or withdraws it.
- A waiver does not authorize any live operation (FR-036 is separate) and does not itself amend Feature 004 (FR-037).
- A design-margin argument alone cannot clear Feature 004 T007 (FR-029).
