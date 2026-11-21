import { createHash } from "node:crypto";
import OpenAI from "openai";

/**
 * The model every AI feature calls. `gpt-6-luna` is OpenAI's named
 * replacement for `gpt-5-nano`, which shuts down on Dec 11, 2026
 * (docs/ai-integration-plan.md §1). One constant, so a retirement is a
 * one-line change.
 */
export const AI_MODEL = "gpt-6-luna";

let client: OpenAI | undefined;

/** Whether a key is set. Unsetting `OPENAI_API_KEY` switches every AI feature off. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * The OpenAI client, created on first use like the Stripe and R2 clients. A
 * button can't wait out the SDK's 10-minute default timeout, and its default
 * two retries would triple a slow call, so 30 s and one retry; calls lower the
 * timeout further per request.
 */
export function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  client ??= new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 });
  return client;
}

/**
 * The per-user id OpenAI uses to trace abuse to one account. Hashed, as
 * OpenAI recommends, so no internal id leaves the server.
 */
export function getSafetyIdentifier(userId: string): string {
  return createHash("sha256").update(userId).digest("hex");
}
