"use server";

import { AuthenticationError, PermissionDeniedError, RateLimitError } from "openai";

import {
  AI_PRO_REQUIRED,
  AI_TAGS_FAILED,
  AI_UNAVAILABLE,
  SESSION_EXPIRED,
} from "@/lib/action-result";
import { autoTagInputSchema, type AutoTagInput } from "@/lib/ai-schemas";
import {
  buildTagInput,
  normalizeTagSuggestions,
  parseTagReply,
  TAG_INSTRUCTIONS,
} from "@/lib/ai-tags";
import { AI_MODEL, getOpenAI, getSafetyIdentifier, isAiConfigured } from "@/lib/openai";
import { getRateLimitMessage, rateLimit } from "@/lib/rate-limit";
import { getSessionEntitlements } from "@/lib/usage-limits";
import type { GenerateAutoTagsResult } from "@/types/ai";

/** A tag reply is a short JSON list, so 200 tokens leaves room without paying for rambling. */
const TAG_MAX_OUTPUT_TOKENS = 200;

/** A button the user is waiting on; the client's 30 s default is too long here. */
const TAG_TIMEOUT_MS = 15_000;

/**
 * A revoked or restricted key, or an OpenAI account out of credits: an
 * operator has to fix these, so telling the user to try again would mislead.
 * Running out of credits is a 429 like OpenAI's own rate limit, told apart by
 * its `insufficient_quota` type (the code varies, e.g. `credit_balance_exhausted`).
 */
function isConfigurationError(error: unknown): boolean {
  return (
    error instanceof AuthenticationError ||
    error instanceof PermissionDeniedError ||
    (error instanceof RateLimitError &&
      (error.type === "insufficient_quota" || error.code === "insufficient_quota"))
  );
}

function failure(error: string): GenerateAutoTagsResult {
  return { success: false, data: null, error };
}

/**
 * Suggests up to five tags for the item being written or edited, from its
 * title and content. Nothing is saved: the form shows the suggestions and the
 * user accepts or rejects each one. Checks run cheapest first, and the rate
 * limit only counts a valid request.
 */
export async function generateAutoTags(input: AutoTagInput): Promise<GenerateAutoTagsResult> {
  const entitlements = await getSessionEntitlements();
  if (!entitlements) {
    return failure(SESSION_EXPIRED);
  }
  if (!entitlements.hasProAccess) {
    return failure(AI_PRO_REQUIRED);
  }
  if (!isAiConfigured()) {
    return failure(AI_UNAVAILABLE);
  }

  const parsed = autoTagInputSchema.safeParse(input);
  if (!parsed.success) {
    return failure(parsed.error.issues[0].message);
  }

  const limit = await rateLimit("ai", entitlements.userId);
  if (!limit.success) {
    return failure(getRateLimitMessage(limit.reset));
  }

  try {
    const response = await getOpenAI().responses.create(
      {
        model: AI_MODEL,
        instructions: TAG_INSTRUCTIONS,
        input: buildTagInput(parsed.data),
        text: { format: { type: "json_object" } },
        reasoning: { effort: "none" },
        max_output_tokens: TAG_MAX_OUTPUT_TOKENS,
        // Nothing reads a response back later, so OpenAI needn't keep it.
        store: false,
        safety_identifier: getSafetyIdentifier(entitlements.userId),
      },
      { timeout: TAG_TIMEOUT_MS },
    );
    const tags = parseTagReply(response.output_text);
    if (!tags) {
      console.error("AI tag reply wasn't JSON tags", {
        status: response.status,
        incomplete: response.incomplete_details?.reason,
      });
      return failure(AI_TAGS_FAILED);
    }

    const suggestions = normalizeTagSuggestions(tags, parsed.data.tags);
    return { success: true, data: { tags: suggestions }, error: null };
  } catch (error) {
    console.error("Suggesting tags failed", error);
    if (isConfigurationError(error)) {
      return failure(AI_UNAVAILABLE);
    }
    return failure(AI_TAGS_FAILED);
  }
}
