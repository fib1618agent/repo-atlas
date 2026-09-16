import { createServerFn } from "@tanstack/react-start";
import { generateText } from "./ai/providers";

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

const summaryCache = new Map<string, { summary: string; expiresAt: number }>();

export const getAISummary = createServerFn({ method: "POST" })
  .validator((data: AISummaryRequest) => data)
  .handler(async ({ data }) => {
    const cacheKey = data.fullName;
    const cached = summaryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { summary: cached.summary, source: "cache" as const };
    }

    let summary: string;
    let source: "ai" | "fallback";

    try {
      const result = await generateText({
        system:
          "You are a concise technical writer. Write a 2-sentence summary of this GitHub repository for developers browsing an open-source atlas. Be specific about what it does and why it's useful. Do not start with the repo name.",
        prompt: `Repository: ${data.fullName}
Description: ${data.description ?? "No description provided"}
Language: ${data.language ?? "Unknown"}
Category: ${data.category} / ${data.subgroup}
Topics: ${data.topics.join(", ") || "none"}
Stars: ${data.stars}

Write exactly 2 sentences. Plain text only, no markdown.`,
        maxOutputTokens: 120,
      });
      summary = result.text;
      source = "ai";
    } catch {
      summary = buildFallbackSummary(data);
      source = "fallback";
    }

    summaryCache.set(cacheKey, { summary, expiresAt: Date.now() + 60 * 60 * 1000 });
    return { summary, source };
  });
