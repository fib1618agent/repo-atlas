import { generateWithAnthropic } from "./anthropic";
import { generateWithGemini } from "./gemini";
import { generateWithGrok } from "./grok";
import { generateWithOpenAI } from "./openai";
import type { GenerateTextRequest, GenerateTextResult, ProviderId } from "./types";

const PROVIDERS: ProviderId[] = ["gemini", "openai", "anthropic", "grok"];

export function getActiveProvider(): ProviderId {
  const raw = process.env["ATLAS_AI_PROVIDER"] ?? "gemini";
  if (PROVIDERS.includes(raw as ProviderId)) {
    return raw as ProviderId;
  }
  console.warn(`[atlas] Unknown ATLAS_AI_PROVIDER "${raw}", defaulting to gemini`);
  return "gemini";
}

export async function generateText(req: GenerateTextRequest): Promise<GenerateTextResult> {
  const provider = getActiveProvider();
  switch (provider) {
    case "gemini":
      return generateWithGemini(req);
    case "openai":
      return generateWithOpenAI(req);
    case "anthropic":
      return generateWithAnthropic(req);
    case "grok":
      return generateWithGrok(req);
  }
}
