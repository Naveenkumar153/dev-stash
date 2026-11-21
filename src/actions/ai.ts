"use server";

import { AuthenticationError, PermissionDeniedError, RateLimitError } from "openai";

import {
  AI_DESCRIPTION_FAILED,
  AI_PRO_REQUIRED,
  AI_TAGS_FAILED,
  AI_UNAVAILABLE,
  SESSION_EXPIRED,
} from "@/lib/action-result";
import {
  buildDescriptionInput,
  DESCRIPTION_INSTRUCTIONS,
  normalizeDescription,
  parseDescriptionReply,
} from "@/lib/ai-description";
import type { AiItemDraft } from "@/lib/ai-item";
import { aiDraftSchema, type AiDraftInput } from "@/lib/ai-schemas";
import {
  buildTagInput,
  normalizeTagSuggestions,
  parseTagReply,
  TAG_INSTRUCTIONS,
} from "@/lib/ai-tags";
import { AI_MODEL, getOpenAI, getSafetyIdentifier, isAiConfigured } from "@/lib/openai";
import { getRateLimitMessage, rateLimit } from "@/lib/rate-limit";
import { getSessionEntitlements } from "@/lib/usage-limits";
import type { GenerateAutoTagsResult, GenerateDescriptionResult } from "@/types/ai";

/** Tags and a description are both short JSON replies; 200 tokens leaves room without paying for rambling. */
const MAX_OUTPUT_TOKENS = 200;

/** A button the user is waiting on; the client's 30 s default is too long here. */
const REQUEST_TIMEOUT_MS = 15_000;

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

interface AiRequest {
  /** Names the request in error logs. */
  label: string;
  instructions: string;
  buildInput: (draft: AiItemDraft) => string;
  /** Returned for failures a retry can fix. */
  failedMessage: string;
}

type AiReply = { ok: true; text: string; draft: AiItemDraft } | { ok: false; error: string };

/**
 * The steps every form-draft AI request shares, cheapest first: the session,
 * Pro access, a configured key, the draft's validity, then the user's `ai`
 * rate limit (so only a valid request counts), then one Responses API call
 * in `json_object` mode. Returns the raw reply text for the caller to parse.
 */
async function requestAi(input: AiDraftInput, request: AiRequest): Promise<AiReply> {
  const entitlements = await getSessionEntitlements();
  if (!entitlements) {
    return { ok: false, error: SESSION_EXPIRED };
  }
  if (!entitlements.hasProAccess) {
    return { ok: false, error: AI_PRO_REQUIRED };
  }
  if (!isAiConfigured()) {
    return { ok: false, error: AI_UNAVAILABLE };
  }

  const parsed = aiDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const limit = await rateLimit("ai", entitlements.userId);
  if (!limit.success) {
    return { ok: false, error: getRateLimitMessage(limit.reset) };
  }

  try {
    const response = await getOpenAI().responses.create(
      {
        model: AI_MODEL,
        instructions: request.instructions,
        input: request.buildInput(parsed.data),
        text: { format: { type: "json_object" } },
        reasoning: { effort: "none" },
        max_output_tokens: MAX_OUTPUT_TOKENS,
        // Nothing reads a response back later, so OpenAI needn't keep it.
        store: false,
        safety_identifier: getSafetyIdentifier(entitlements.userId),
      },
      { timeout: REQUEST_TIMEOUT_MS },
    );
    return { ok: true, text: response.output_text, draft: parsed.data };
  } catch (error) {
    console.error(`${request.label} failed`, error);
    return {
      ok: false,
      error: isConfigurationError(error) ? AI_UNAVAILABLE : request.failedMessage,
    };
  }
}

/**
 * Suggests up to five tags for the item being written or edited, from its
 * title and content. Nothing is saved: the form shows the suggestions and the
 * user accepts or rejects each one.
 */
export async function generateAutoTags(input: AiDraftInput): Promise<GenerateAutoTagsResult> {
  const reply = await requestAi(input, {
    label: "Suggesting tags",
    instructions: TAG_INSTRUCTIONS,
    buildInput: buildTagInput,
    failedMessage: AI_TAGS_FAILED,
  });
  if (!reply.ok) {
    return { success: false, data: null, error: reply.error };
  }

  const tags = parseTagReply(reply.text);
  if (!tags) {
    console.error("AI tag reply wasn't JSON tags");
    return { success: false, data: null, error: AI_TAGS_FAILED };
  }

  return {
    success: true,
    data: { tags: normalizeTagSuggestions(tags, reply.draft.tags) },
    error: null,
  };
}

/**
 * Writes a one- or two-sentence description of the item being written or
 * edited, from whatever the form holds: title, content, URL, file name, tags.
 * Nothing is saved: the form puts it in the Description field.
 */
export async function generateDescription(
  input: AiDraftInput,
): Promise<GenerateDescriptionResult> {
  const reply = await requestAi(input, {
    label: "Generating a description",
    instructions: DESCRIPTION_INSTRUCTIONS,
    buildInput: buildDescriptionInput,
    failedMessage: AI_DESCRIPTION_FAILED,
  });
  if (!reply.ok) {
    return { success: false, data: null, error: reply.error };
  }

  const parsed = parseDescriptionReply(reply.text);
  // A reply of only quotes cleans up to nothing; don't empty the field with it.
  const description = parsed && normalizeDescription(parsed);
  if (!description) {
    console.error("AI description reply wasn't a JSON description");
    return { success: false, data: null, error: AI_DESCRIPTION_FAILED };
  }

  return { success: true, data: { description }, error: null };
}
