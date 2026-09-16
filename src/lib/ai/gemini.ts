import { AtlasError, atlasErrorMessage } from "@/lib/atlas-errors";
import type { GenerateTextRequest, GenerateTextResult } from "./types";

export async function generateWithGemini(req: GenerateTextRequest): Promise<GenerateTextResult> {
  const apiKey = process.env["GEMINI_API_KEY"] ?? "";
  if (!apiKey) {
    throw new AtlasError(
      "AI_NOT_CONFIGURED",
      atlasErrorMessage("AI_NOT_CONFIGURED", { provider: "gemini" }),
    );
  }

  const model = process.env["GEMINI_MODEL"] ?? "gemini-2.0-flash";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${req.system}\n\n${req.prompt}` }] }],
        generationConfig: { maxOutputTokens: req.maxOutputTokens, temperature: 0.4 },
      }),
    },
  );
  if (!response.ok) {
    throw new AtlasError("AI_UPSTREAM", atlasErrorMessage("AI_UPSTREAM"), {
      detail: `Gemini returned ${response.status}`,
    });
  }
  const json = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new AtlasError("AI_UPSTREAM", atlasErrorMessage("AI_UPSTREAM"), {
      detail: "Empty response from Gemini",
    });
  }
  return { text, provider: "gemini", model };
}
