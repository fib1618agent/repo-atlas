/**
 * Generic language → colour lookup for structure marbles (Feature 009
 * FR-017/FR-020). Keyed by Feature 002's detected language ids and common
 * extension buckets; unknown keys fall back to a neutral tone. Not specific to
 * any repository.
 */
const LANGUAGE_COLORS: Record<string, string> = {
  typescript: "#3178c6",
  tsx: "#3178c6",
  javascript: "#f7df1e",
  java: "#b07219",
  ".md": "#94a3b8",
  ".json": "#f59e0b",
  ".css": "#563d7c",
  ".html": "#e34c26",
  ".yml": "#38bdf8",
  ".yaml": "#38bdf8",
  ".sh": "#89e051",
  ".py": "#3572a5",
  ".go": "#00add8",
  ".rs": "#dea584",
  ".sql": "#e38c00",
};

export const NEUTRAL_LANGUAGE_COLOR = "#64748b";

export function languageColor(key: string | null): string {
  if (!key) return NEUTRAL_LANGUAGE_COLOR;
  return LANGUAGE_COLORS[key.toLowerCase()] ?? NEUTRAL_LANGUAGE_COLOR;
}
