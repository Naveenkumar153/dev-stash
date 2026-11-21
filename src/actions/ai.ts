"use server";

import { AuthenticationError, PermissionDeniedError, RateLimitError } from "openai";

import {
  AI_DESCRIPTION_FAILED,
  AI_EXPLAIN_FAILED,
  AI_OPTIMIZE_FAILED,
  AI_PRO_REQUIRED,
  AI_TAGS_FAILED,
  AI_UNAVAILABLE,
  ITEM_NOT_FOUND,
  SESSION_EXPIRED,
  actionFailure,
} from "@/lib/action-result";
import {
  buildDescriptionInput,
  DESCRIPTION_INSTRUCTIONS,
  normalizeDescription,
  parseDescriptionReply,
} from "@/lib/ai-description";
import {
  AI_EXPLAIN_LIMIT,
  buildExplainInput,
  canExplain,
  EXPLAIN_INSTRUCTIONS,
  EXPLAIN_NO_CODE,
  EXPLAIN_TOO_LONG,
  EXPLAIN_WRONG_TYPE,
  normalizeExplanation,
} from "@/lib/ai-explain";
import type { AiItemDraft, SavedAiItem } from "@/lib/ai-item";
import {
  AI_OPTIMIZE_LIMIT,
  buildOptimizeInput,
  canOptimize,
  OPTIMIZE_INSTRUCTIONS,
  OPTIMIZE_NO_PROMPT,
  OPTIMIZE_TOO_LONG,
  OPTIMIZE_WRONG_TYPE,
  parseOptimizeReply,
} from "@/lib/ai-optimize";
import { aiDraftSchema, type AiDraftInput } from "@/lib/ai-schemas";
import {
  buildTagInput,
  normalizeTagSuggestions,
  parseTagReply,
  TAG_INSTRUCTIONS,
} from "@/lib/ai-tags";
import { getItemForAi } from "@/lib/db/items";
import { itemIdSchema } from "@/lib/item-schemas";
import { AI_MODEL, getOpenAI, getSafetyIdentifier, isAiConfigured } from "@/lib/openai";
import { getRateLimitError } from "@/lib/rate-limit";
import { getSessionEntitlements } from "@/lib/usage-limits";
import type {
  ExplainCodeResult,
  GenerateAutoTagsResult,
  GenerateDescriptionResult,
  OptimizePromptResult,
} from "@/types/ai";

/** Tags and a description are both short JSON replies; 200 tokens leaves room without paying for rambling. */
const DRAFT_OUTPUT_TOKENS = 200;

/** A button the user is waiting on; the client's 30 s default is too long here. */
const DRAFT_TIMEOUT_MS = 15_000;

/**
 * About 300 words of Markdown is roughly 450 tokens; the rest is room for
 * `low` effort's reasoning, which is billed as output.
 */
const EXPLAIN_OUTPUT_TOKENS = 2_000;

/** A longer answer than tags or a description, so it gets the client's full timeout. */
const EXPLAIN_TIMEOUT_MS = 30_000;

/** A whole rewritten prompt (up to 12,000 characters in) plus `low` effort's reasoning. */
const OPTIMIZE_OUTPUT_TOKENS = 5_000;

/** Rewriting a long prompt can take a while; the per-request timeout overrides the client's 30 s. */
const OPTIMIZE_TIMEOUT_MS = 60_000;

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

type Outcome<T> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * The checks every AI request starts with, cheapest first: a session, Pro
 * access and a configured key.
 */
async function checkAiAccess(): Promise<Outcome<{ userId: string }>> {
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
  return { ok: true, userId: entitlements.userId };
}

interface ModelCall {
  /** Names the request in error logs. */
  label: string;
  instructions: string;
  input: string;
  /** `json_object` mode, which needs the word "JSON" in `input`; plain text otherwise. */
  json: boolean;
  effort: "none" | "low";
  maxOutputTokens: number;
  timeoutMs: number;
  /** Returned for failures a retry can fix. */
  failedMessage: string;
}

/**
 * Counts the request against the user's `ai` rate limit, then makes one
 * Responses API call. Callers validate first, so only a valid request counts.
 * Returns the raw reply text for the caller to parse.
 */
async function callModel(userId: string, call: ModelCall): Promise<Outcome<{ text: string }>> {
  const rateLimitError = await getRateLimitError("ai", userId);
  if (rateLimitError) {
    return { ok: false, error: rateLimitError };
  }

  try {
    const response = await getOpenAI().responses.create(
      {
        model: AI_MODEL,
        instructions: call.instructions,
        input: call.input,
        text: { format: { type: call.json ? "json_object" : "text" } },
        reasoning: { effort: call.effort },
        max_output_tokens: call.maxOutputTokens,
        // Nothing reads a response back later, so OpenAI needn't keep it.
        store: false,
        safety_identifier: getSafetyIdentifier(userId),
      },
      { timeout: call.timeoutMs },
    );
    return { ok: true, text: response.output_text };
  } catch (error) {
    console.error(`${call.label} failed`, error);
    return {
      ok: false,
      error: isConfigurationError(error) ? AI_UNAVAILABLE : call.failedMessage,
    };
  }
}

interface DraftRequest {
  label: string;
  instructions: string;
  buildInput: (draft: AiItemDraft) => string;
  failedMessage: string;
}

/**
 * A request about the New Item / edit form's draft: access, the draft's
 * validity, then one short `json_object` call.
 */
async function requestDraftAi(
  input: AiDraftInput,
  request: DraftRequest,
): Promise<Outcome<{ text: string; draft: AiItemDraft }>> {
  const access = await checkAiAccess();
  if (!access.ok) {
    return access;
  }

  const parsed = aiDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const reply = await callModel(access.userId, {
    label: request.label,
    instructions: request.instructions,
    input: request.buildInput(parsed.data),
    json: true,
    effort: "none",
    maxOutputTokens: DRAFT_OUTPUT_TOKENS,
    timeoutMs: DRAFT_TIMEOUT_MS,
    failedMessage: request.failedMessage,
  });
  return reply.ok ? { ok: true, text: reply.text, draft: parsed.data } : reply;
}

/**
 * Suggests up to five tags for the item being written or edited, from its
 * title and content. Nothing is saved: the form shows the suggestions and the
 * user accepts or rejects each one.
 */
export async function generateAutoTags(input: AiDraftInput): Promise<GenerateAutoTagsResult> {
  const reply = await requestDraftAi(input, {
    label: "Suggesting tags",
    instructions: TAG_INSTRUCTIONS,
    buildInput: buildTagInput,
    failedMessage: AI_TAGS_FAILED,
  });
  if (!reply.ok) {
    return actionFailure(reply.error);
  }

  const tags = parseTagReply(reply.text);
  if (!tags) {
    console.error("AI tag reply wasn't JSON tags");
    return actionFailure(AI_TAGS_FAILED);
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
  const reply = await requestDraftAi(input, {
    label: "Generating a description",
    instructions: DESCRIPTION_INSTRUCTIONS,
    buildInput: buildDescriptionInput,
    failedMessage: AI_DESCRIPTION_FAILED,
  });
  if (!reply.ok) {
    return actionFailure(reply.error);
  }

  const parsed = parseDescriptionReply(reply.text);
  // A reply of only quotes cleans up to nothing; don't empty the field with it.
  const description = parsed && normalizeDescription(parsed);
  if (!description) {
    console.error("AI description reply wasn't a JSON description");
    return actionFailure(AI_DESCRIPTION_FAILED);
  }

  return { success: true, data: { description }, error: null };
}

/** What a drawer AI action accepts, and the message for each refusal. */
interface SavedItemRules {
  /** Names the load in error logs. */
  label: string;
  accepts: (typeName: string) => boolean;
  wrongType: string;
  empty: string;
  maxLength: number;
  tooLong: string;
  failedMessage: string;
}

/**
 * Loads a saved item for a drawer AI action, scoped to the user, and checks
 * its type, that it has content, and that the content is within the limit.
 */
async function loadSavedItem(
  userId: string,
  itemId: string,
  rules: SavedItemRules,
): Promise<Outcome<{ item: SavedAiItem }>> {
  if (!itemIdSchema.safeParse(itemId).success) {
    return { ok: false, error: ITEM_NOT_FOUND };
  }

  let item: SavedAiItem | null;
  try {
    item = await getItemForAi(userId, itemId);
  } catch (error) {
    console.error(`${rules.label} failed`, error);
    return { ok: false, error: rules.failedMessage };
  }

  if (!item) {
    return { ok: false, error: ITEM_NOT_FOUND };
  }
  if (!rules.accepts(item.typeName)) {
    return { ok: false, error: rules.wrongType };
  }
  if (!item.content.trim()) {
    return { ok: false, error: rules.empty };
  }
  if (item.content.length > rules.maxLength) {
    return { ok: false, error: rules.tooLong };
  }
  return { ok: true, item };
}

/**
 * Explains a saved snippet or command in about 200-300 words of Markdown.
 * Takes only the item's id: the code is read from the database, scoped to the
 * session user, so it explains exactly what's saved and can't be pointed at
 * other text. Nothing is stored; each click asks again.
 */
export async function explainCode(itemId: string): Promise<ExplainCodeResult> {
  const access = await checkAiAccess();
  if (!access.ok) {
    return actionFailure(access.error);
  }

  const loaded = await loadSavedItem(access.userId, itemId, {
    label: "Loading the item to explain",
    accepts: canExplain,
    wrongType: EXPLAIN_WRONG_TYPE,
    empty: EXPLAIN_NO_CODE,
    maxLength: AI_EXPLAIN_LIMIT,
    tooLong: EXPLAIN_TOO_LONG,
    failedMessage: AI_EXPLAIN_FAILED,
  });
  if (!loaded.ok) {
    return actionFailure(loaded.error);
  }

  const reply = await callModel(access.userId, {
    label: "Explaining code",
    instructions: EXPLAIN_INSTRUCTIONS,
    input: buildExplainInput(loaded.item),
    json: false,
    effort: "low",
    maxOutputTokens: EXPLAIN_OUTPUT_TOKENS,
    timeoutMs: EXPLAIN_TIMEOUT_MS,
    failedMessage: AI_EXPLAIN_FAILED,
  });
  if (!reply.ok) {
    return actionFailure(reply.error);
  }

  const explanation = normalizeExplanation(reply.text);
  if (!explanation) {
    console.error("AI explanation reply was empty");
    return actionFailure(AI_EXPLAIN_FAILED);
  }

  return { success: true, data: { explanation }, error: null };
}

/**
 * Reviews a saved prompt and refines it only if it needs it. Takes only the
 * item's id, like Explain, so it reviews exactly what's saved. Nothing is
 * written here: the drawer asks the user whether to use the refined prompt
 * and saves it through `setItemContent`.
 */
export async function optimizePrompt(itemId: string): Promise<OptimizePromptResult> {
  const access = await checkAiAccess();
  if (!access.ok) {
    return actionFailure(access.error);
  }

  const loaded = await loadSavedItem(access.userId, itemId, {
    label: "Loading the prompt to optimize",
    accepts: canOptimize,
    wrongType: OPTIMIZE_WRONG_TYPE,
    empty: OPTIMIZE_NO_PROMPT,
    maxLength: AI_OPTIMIZE_LIMIT,
    tooLong: OPTIMIZE_TOO_LONG,
    failedMessage: AI_OPTIMIZE_FAILED,
  });
  if (!loaded.ok) {
    return actionFailure(loaded.error);
  }

  const reply = await callModel(access.userId, {
    label: "Optimizing a prompt",
    instructions: OPTIMIZE_INSTRUCTIONS,
    input: buildOptimizeInput(loaded.item),
    json: true,
    effort: "low",
    maxOutputTokens: OPTIMIZE_OUTPUT_TOKENS,
    timeoutMs: OPTIMIZE_TIMEOUT_MS,
    failedMessage: AI_OPTIMIZE_FAILED,
  });
  if (!reply.ok) {
    return actionFailure(reply.error);
  }

  const optimization = parseOptimizeReply(reply.text, loaded.item.content);
  if (!optimization) {
    console.error("AI prompt optimization reply wasn't the expected JSON");
    return actionFailure(AI_OPTIMIZE_FAILED);
  }

  return { success: true, data: optimization, error: null };
}
