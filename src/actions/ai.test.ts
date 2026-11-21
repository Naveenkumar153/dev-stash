import type { Session } from "next-auth";
import {
  AuthenticationError,
  InternalServerError,
  PermissionDeniedError,
  RateLimitError,
} from "openai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateAutoTags } from "@/actions/ai";
import { auth } from "@/auth";
import {
  AI_PRO_REQUIRED,
  AI_TAGS_FAILED,
  AI_UNAVAILABLE,
  SESSION_EXPIRED,
} from "@/lib/action-result";
import type { AutoTagInput } from "@/lib/ai-schemas";
import { AI_TAG_CONTENT_LIMIT, AI_TAGS_NEED_INPUT, TAG_INSTRUCTIONS } from "@/lib/ai-tags";
import { AI_MODEL, getOpenAI, getSafetyIdentifier } from "@/lib/openai";
import { rateLimit } from "@/lib/rate-limit";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
// The usage limits module loads Prisma; nothing here counts rows.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
// Only the client is mocked: the model constant, the key check and the
// safety identifier are the real ones.
vi.mock("@/lib/openai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/openai")>()),
  getOpenAI: vi.fn(),
}));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  rateLimit: vi.fn(),
}));

/** `auth` is overloaded (it doubles as middleware), so its mock is typed by hand. */
const mockAuth = auth as unknown as ReturnType<typeof vi.fn<() => Promise<Session | null>>>;

const create = vi.fn();

function signIn(isPro: boolean) {
  mockAuth.mockResolvedValue({ user: { id: "user-1", isPro }, expires: "2099-01-01T00:00:00.000Z" });
}

function reply(outputText: string) {
  create.mockResolvedValue({ output_text: outputText, status: "completed", incomplete_details: null });
}

const draft: AutoTagInput = {
  typeName: "snippet",
  title: "  useDebounce hook ",
  description: "Debounces a value",
  content: "export function useDebounce<T>(value: T, delay = 300) {}",
  url: "",
  language: "typescript",
  tags: ["react"],
};

beforeEach(() => {
  signIn(true);
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
  vi.mocked(getOpenAI).mockReturnValue({ responses: { create } } as never);
  vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 19, reset: Date.now() });
  reply('{"tags": ["React", "Hooks", "TypeScript", "debounce"]}');
});

describe("generateAutoTags", () => {
  it("returns normalized suggestions the item doesn't already have", async () => {
    expect(await generateAutoTags(draft)).toEqual({
      success: true,
      data: { tags: ["hooks", "typescript", "debounce"] },
      error: null,
    });
  });

  it("calls the Responses API in JSON mode with the user's hashed id", async () => {
    await generateAutoTags(draft);

    expect(create).toHaveBeenCalledTimes(1);
    const [request, options] = create.mock.calls[0];
    expect(request).toMatchObject({
      model: AI_MODEL,
      instructions: TAG_INSTRUCTIONS,
      text: { format: { type: "json_object" } },
      store: false,
      safety_identifier: getSafetyIdentifier("user-1"),
    });
    expect(request.input).toContain("<title>useDebounce hook</title>");
    expect(request.input).toContain('language="typescript"');
    expect(request.input).toContain("<current_tags>react</current_tags>");
    expect(options).toEqual({ timeout: 15_000 });
  });

  it("sends at most the first 2000 characters of content", async () => {
    await generateAutoTags({ ...draft, content: `${"a".repeat(AI_TAG_CONTENT_LIMIT)}TAIL` });

    const { input } = create.mock.calls[0][0];
    expect(input).toContain("a".repeat(AI_TAG_CONTENT_LIMIT));
    expect(input).not.toContain("TAIL");
    expect(input).toContain("[...truncated]");
  });

  it("accepts a bare JSON array reply", async () => {
    reply('["Docker", "docker compose"]');

    expect(await generateAutoTags(draft)).toMatchObject({
      success: true,
      data: { tags: ["docker", "docker-compose"] },
    });
  });

  it("counts the request against the user's AI limit", async () => {
    await generateAutoTags(draft);
    expect(rateLimit).toHaveBeenCalledWith("ai", "user-1");
  });

  it("refuses a signed-out request without calling OpenAI", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await generateAutoTags(draft)).toEqual({ success: false, data: null, error: SESSION_EXPIRED });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses a Free account while gating is on, before counting or calling", async () => {
    vi.stubEnv("PRO_GATING_ENABLED", "true");
    signIn(false);

    expect(await generateAutoTags(draft)).toEqual({ success: false, data: null, error: AI_PRO_REQUIRED });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("lets a Free account through while gating is off", async () => {
    signIn(false);
    expect(await generateAutoTags(draft)).toMatchObject({ success: true });
  });

  it("answers unavailable when no key is set", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    expect(await generateAutoTags(draft)).toEqual({ success: false, data: null, error: AI_UNAVAILABLE });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a draft with no title or content without spending quota", async () => {
    expect(await generateAutoTags({ ...draft, title: "  ", content: " \n" })).toEqual({
      success: false,
      data: null,
      error: AI_TAGS_NEED_INPUT,
    });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an item type that can't be created", async () => {
    expect(await generateAutoTags({ ...draft, typeName: "folder" })).toEqual({
      success: false,
      data: null,
      error: "Choose an item type",
    });
  });

  it("returns the rate-limit message once the hour's requests are used", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T12:00:00Z"));
    vi.mocked(rateLimit).mockResolvedValue({
      success: false,
      remaining: 0,
      reset: Date.now() + 10 * 60 * 1000,
    });

    expect(await generateAutoTags(draft)).toEqual({
      success: false,
      data: null,
      error: "Too many attempts. Please try again in 10 minutes.",
    });
    expect(create).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it.each(["", "not json", '{"labels": ["react"]}', '"react"'])(
    "fails on a reply that isn't JSON tags: %j",
    async (outputText) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      reply(outputText);

      expect(await generateAutoTags(draft)).toEqual({ success: false, data: null, error: AI_TAGS_FAILED });
    },
  );

  it.each([
    ["a rejected key", new AuthenticationError(401, undefined, "bad key", new Headers())],
    ["a restricted key", new PermissionDeniedError(403, undefined, "no access", new Headers())],
    [
      "an account out of credits",
      new RateLimitError(
        429,
        { type: "insufficient_quota", code: "credit_balance_exhausted" },
        "no credits",
        new Headers(),
      ),
    ],
    [
      "an older out-of-quota reply",
      new RateLimitError(429, { code: "insufficient_quota" }, "no quota", new Headers()),
    ],
  ])("answers unavailable for %s", async (_label, error) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    create.mockRejectedValue(error);

    expect(await generateAutoTags(draft)).toEqual({ success: false, data: null, error: AI_UNAVAILABLE });
  });

  it("answers a generic failure for OpenAI's own rate limit, which a retry can clear", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    create.mockRejectedValue(
      new RateLimitError(
        429,
        { type: "requests", code: "rate_limit_exceeded" },
        "slow down",
        new Headers(),
      ),
    );

    expect(await generateAutoTags(draft)).toEqual({ success: false, data: null, error: AI_TAGS_FAILED });
  });

  it("answers a generic failure for any other error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    create.mockRejectedValue(new InternalServerError(500, undefined, "boom", new Headers()));

    expect(await generateAutoTags(draft)).toEqual({ success: false, data: null, error: AI_TAGS_FAILED });
  });
});
