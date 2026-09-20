/**
 * Deterministic, extension-based language detection (FR-001, FR-002, FR-003).
 * No content sniffing — the language is decided purely from the path,
 * per contracts/language-grammar-provider.md and research.md §4.
 */

export type SupportedLanguage = "java" | "javascript" | "typescript" | "tsx";

const EXTENSION_TO_LANGUAGE: Record<string, SupportedLanguage> = {
  java: "java",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
};

export function detectLanguage(path: string): SupportedLanguage | null {
  const lastDot = path.lastIndexOf(".");
  if (lastDot === -1 || lastDot === path.length - 1) return null;
  const extension = path.slice(lastDot + 1).toLowerCase();
  return EXTENSION_TO_LANGUAGE[extension] ?? null;
}
