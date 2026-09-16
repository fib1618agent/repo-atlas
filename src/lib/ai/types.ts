export type ProviderId = "gemini" | "openai" | "anthropic" | "grok";

export type GenerateTextRequest = {
  system: string;
  prompt: string;
  maxOutputTokens: number;
};

export type GenerateTextResult = {
  text: string;
  provider: ProviderId;
  model: string;
};
