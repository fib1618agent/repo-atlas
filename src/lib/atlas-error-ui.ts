import type { SourceFailure } from "./atlas-errors";

/** Map server source failures back to dialog row indices for inline errors. */
export function mapSourceFailuresToRows(
  rows: string[],
  failures: SourceFailure[],
): Record<number, string> {
  const errors: Record<number, string> = {};

  for (const failure of failures) {
    const idx = rows.findIndex((row) => {
      const trimmed = row.trim().toLowerCase();
      if (!trimmed) return false;
      const raw = failure.raw.trim().toLowerCase();
      const login = failure.login.toLowerCase();
      return trimmed === raw || trimmed.includes(login) || raw.includes(trimmed);
    });
    if (idx >= 0) {
      errors[idx] = failure.message;
    }
  }

  return errors;
}
