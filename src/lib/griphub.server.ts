import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const GRIPHUB_DEFAULT_BASE_URL = "https://griphubrouter.web.id/v1";
export const GRIPHUB_DEFAULT_MODEL = "grok-4.6";

/** Max tokens allowed per conversation turn. */
export const GRIPHUB_MAX_TOKENS = 25000;

export function createGriphubProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "griphub",
    baseURL: process.env["GRIPHUB_BASE_URL"] || GRIPHUB_DEFAULT_BASE_URL,
    apiKey,
  });
}

export function griphubModelId() {
  return process.env["GRIPHUB_MODEL"] || GRIPHUB_DEFAULT_MODEL;
}
