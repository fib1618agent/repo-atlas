import { createServerFn } from "@tanstack/react-start";

type AISummaryRequest = {
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  topics: string[];
  stars: number;
  forks: number;
  category: string;
  subgroup: string;
};

function buildFallbackSummary(req: AISummaryRequest): string {
  const lang = req.language ? `a ${req.language}` : "an open-source";
  const topicStr = req.topics.slice(0, 3).join(", ");
  const topicPart = topicStr ? ` Key topics include ${topicStr}.` : "";
  const stars = req.stars > 0 ? ` It has earned ${req.stars.toLocaleString()} stars on GitHub.` : "";
  const desc = req.description ? ` ${req.description}.` : "";
  return `${req.name} is ${lang} repository in the ${req.subgroup} space, falling under the broader ${req.category} category.${desc}${topicPart}${stars} Explore the code to discover its full capabilities.`;
}

async function generateWithGemini(req: AISummaryRequest, apiKey: string): Promise<string> {
  const prompt = `You are a concise technical writer. Write a 2-sentence summary of this GitHub repository for developers browsing an open-source atlas. Be specific about what it does and why it's useful. Do not start with the repo name.

Repository: ${req.fullName}
Description: ${req.description ?? "No description provided"}
Language: ${req.language ?? "Unknown"}
Category: ${req.category} / ${req.subgroup}
Topics: ${req.topics.join(", ") || "none"}
Stars: ${req.stars}

Write exactly 2 sentences. Plain text only, no markdown.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 120, temperature: 0.4 },
      }),
    }
  );
  if (!response.ok) throw new Error(`Gemini returned ${response.status}`);
  const json = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}

const summaryCache = new Map<string, { summary: string; expiresAt: number }>();

export const getAISummary = createServerFn({ method: "POST" })
  .validator((data: AISummaryRequest) => data)
  .handler(async ({ data }) => {
    const cacheKey = data.fullName;
    const cached = summaryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { summary: cached.summary, source: "cache" as const };
    }

    const apiKey = process.env["GEMINI_API_KEY"] ?? process.env["VITE_GEMINI_API_KEY"] ?? "";

    let summary: string;
    let source: "ai" | "fallback";

    if (apiKey) {
      try {
        summary = await generateWithGemini(data, apiKey);
        source = "ai";
      } catch {
        summary = buildFallbackSummary(data);
        source = "fallback";
      }
    } else {
      summary = buildFallbackSummary(data);
      source = "fallback";
    }

    summaryCache.set(cacheKey, { summary, expiresAt: Date.now() + 60 * 60 * 1000 });
    return { summary, source };
  });
