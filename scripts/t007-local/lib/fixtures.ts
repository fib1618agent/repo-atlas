import type { SupportedLanguage } from "../../../src/lib/code-intel/symbols/language-detector";

/**
 * Synthetic M-L1/M-L2 fixtures (neutral domains: car rental / fleet / pricing / payment). Every fixture records its ACTUAL bytes, lines and AST node
 * counts at measurement time (R3 lesson: never trust the intended size). Two shapes: "ordinary" (line-oriented declarations) and "dense"
 * (long single-line expressions with many calls). TSX reuses the TS templates (JSX adds nothing the relationship queries match).
 */
export type Density = "ordinary" | "dense";
export const BANDS: { id: string; label: string; bytes: number }[] = [
  { id: "B1", label: "<=4KiB", bytes: 4000 },
  { id: "B2", label: "16KiB", bytes: 16 * 1024 },
  { id: "B3", label: "64KiB", bytes: 64 * 1024 },
  { id: "B4", label: "256KiB", bytes: 256 * 1024 },
  { id: "B5", label: "512KiB", bytes: 512 * 1024 },
  { id: "B6", label: "1MiB", bytes: 1024 * 1024 },
  { id: "B7", label: "4MiB", bytes: 4 * 1024 * 1024 },
  { id: "B8", label: "10MiB", bytes: 10 * 1024 * 1024 - 4096 }, // stays under the 10 MiB production cap
];
export const EXT: Record<SupportedLanguage, string> = {
  java: "java",
  javascript: "js",
  typescript: "ts",
  tsx: "tsx",
};

const fill = (header: string, block: (i: number) => string, bytes: number) => {
  const parts = [header];
  let n = header.length,
    i = 0;
  while (n < bytes) {
    const b = block(i++);
    parts.push(b);
    n += b.length;
  }
  return parts.join("");
};
const tsHeader = (typed: boolean) => {
  const t = (s: string) => (typed ? s : "");
  let h = `import { Money } from './money';\nimport { Zone } from './zone';\n`;
  for (let k = 0; k < 10; k++)
    h += `function helper${k}(n${t(": number")})${t(": number")} { return n + ${k}; }\nfunction compute${k}(a${t(": number")}, b${t(": number")}, c${t(": number")} = 0)${t(": number")} { return a * b + c + ${k}; }\n`;
  h += `function lookup(r${t(": number")}, z${t(": number")})${t(": number")} { return r + z; }\nfunction fmt(d${t(": number")})${t(": string")} { return String(d); }\nfunction scale(i${t(": number")})${t(": number")} { return i * 2; }\n`;
  return h;
};
export function generate(
  lang: SupportedLanguage,
  density: Density,
  bytes: number,
): string {
  if (lang === "java") {
    const header = `class Helpers {\n${Array.from({ length: 10 }, (_, k) => `  static int helper${k}(int n) {\n    return n + ${k};\n  }\n  static int compute${k}(int a, int b, int c) {\n    return a * b + c + ${k};\n  }\n`).join("")}  static int lookup(int r, int z) {\n    return r + z;\n  }\n  static String fmt(int d) {\n    return String.valueOf(d);\n  }\n  static int scale(int i) {\n    return i * 2;\n  }\n}\n`;
    if (density === "ordinary")
      return fill(
        header,
        (i) =>
          `interface Payable${i} {\n  int total();\n}\n\nclass Rental${i} implements Payable${i} {\n  private final int fleet = ${i};\n\n  public int total() {\n    int base = price(fleet);\n    return base + helper${i % 10}(fleet);\n  }\n\n  int price(int days) {\n    return days * ${i % 97};\n  }\n}\n\n`,
        bytes,
      );
    // dense: ONE class with many long-expression methods
    return (
      fill(
        header +
          "class Quotes {\n  int rate = 1;\n  int discount = 2;\n  int[] rates = new int[4];\n  Zone zone;\n  Pricing pricing;\n",
        (i) =>
          `  int quote${i}(int days, int fleet) { return compute${i % 10}(days + fleet * (rate - discount), lookup(rates[${i % 4}], zone.code), pricing.apply(days, fleet, ${i})) + scale(${i}); }\n`,
        bytes,
      ) + "}\n"
    );
  }
  const typed = lang !== "javascript";
  const t = (s: string) => (typed ? s : "");
  if (density === "ordinary")
    return fill(
      tsHeader(typed),
      (i) =>
        `${typed ? `export interface Payable${i} {\n  total(): number;\n}\n\n` : ""}export class Rental${i}${t(` implements Payable${i}`)} {\n  constructor(${typed ? "private readonly fleet: number" : "fleet"}) {\n${typed ? "" : "    this.fleet = fleet;\n"}  }\n\n  total()${t(": number")} {\n    const base = this.price(this.fleet);\n    return base + helper${i % 10}(this.fleet);\n  }\n\n  price(days${t(": number")})${t(": number")} {\n    return days * ${i % 97};\n  }\n}\n\n`,
      bytes,
    );
  return fill(
    tsHeader(typed),
    (i) =>
      `export const quote${i} = compute${i % 10}(days + fleet * (rate - discount), lookup(rates[${i % 4}], zone.city.code), pricing.rules.apply(days, fleet, ${i})) + scale(${i});\n`,
    bytes,
  );
}

/** Resolver-scaling probes (TS): isolate what the resolution cost depends on. */
export type Probe =
  | "P1-unique-symbols-calls-in-file"
  | "P2-external-calls"
  | "P3-same-name-candidates"
  | "P4-fixed-symbols-growing-calls"
  | "P5-fixed-calls-growing-symbols";
export function generateProbe(kind: Probe, n: number): string {
  const common = "function helperCommon(n: number): number { return n + 1; }\n";
  switch (kind) {
    case "P1-unique-symbols-calls-in-file": // N unique functions, each with one call to an in-file symbol
      return (
        common +
        Array.from(
          { length: n },
          (_, k) =>
            `function fn${k}(): number { return helperCommon(${k}); }\n`,
        ).join("")
      );
    case "P2-external-calls": // N functions, each with one call to a name that exists nowhere
      return (
        common +
        Array.from(
          { length: n },
          (_, k) =>
            `function fn${k}(): number { return external${k % 50}(${k}); }\n`,
        ).join("")
      );
    case "P3-same-name-candidates": // N classes with a method `run`, each calling `run`: N same-name in-file candidates per call
      return Array.from(
        { length: n },
        (_, k) =>
          `class C${k} { run(): number { return this.run() + ${k}; } }\n`,
      ).join("");
    case "P4-fixed-symbols-growing-calls": // 100 functions, N calls inside one function
      return (
        common +
        Array.from(
          { length: 100 },
          (_, k) => `function fn${k}(): number { return ${k}; }\n`,
        ).join("") +
        `function big(): number {\n${Array.from({ length: n }, (_, k) => `  helperCommon(${k});\n`).join("")}  return 0;\n}\n`
      );
    case "P5-fixed-calls-growing-symbols": // 100 calls, N functions without calls
      return (
        common +
        Array.from(
          { length: n },
          (_, k) => `function fn${k}(): number { return ${k}; }\n`,
        ).join("") +
        `function big(): number {\n${Array.from({ length: 100 }, (_, k) => `  helperCommon(${k});\n`).join("")}  return 0;\n}\n`
      );
  }
}
