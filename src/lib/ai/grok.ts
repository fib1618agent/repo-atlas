import { AtlasError, atlasErrorMessage } from "@/lib/atlas-errors";
import type { GenerateTextRequest, GenerateTextResult } from "./types";

export async function generateWithGrok(_req: GenerateTextRequest): Promise<GenerateTextResult> {
  throw new AtlasError(
    "AI_PROVIDER_UNIMPLEMENTED",
    atlasErrorMessage("AI_PROVIDER_UNIMPLEMENTED", { provider: "grok" }),
  );
}
