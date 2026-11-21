import type { Session } from "next-auth";
import {
  AuthenticationError,
  InternalServerError,
  PermissionDeniedError,
  RateLimitError,
} from "openai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { explainCode, generateAutoTags, generateDescription } from "@/actions/ai";
import { auth } from "@/auth";
import {
  AI_DESCRIPTION_FAILED,
  AI_EXPLAIN_FAILED,
  AI_PRO_REQUIRED,
  AI_TAGS_FAILED,
  AI_UNAVAILABLE,
  ITEM_NOT_FOUND,
  SESSION_EXPIRED,
} from "@/lib/action-result";
import { DESCRIPTION_INSTRUCTIONS } from "@/lib/ai-description";
import {
  AI_EXPLAIN_LIMIT,
  EXPLAIN_INSTRUCTIONS,
  EXPLAIN_NO_CODE,
  EXPLAIN_TOO_LONG,
  EXPLAIN_WRONG_TYPE,
  type ExplainableItem,
} from "@/lib/ai-explain";
import { AI_CONTENT_LIMIT, AI_NEEDS_INPUT } from "@/lib/ai-item";
import type { AiDraftInput } from "@/lib/ai-schemas";
import { TAG_INSTRUCTIONS } from "@/lib/ai-tags";
import { getItemCode } from "@/lib/db/items";
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
// Explain reads the item through this query; the rest of the module is real.
vi.mock("@/lib/db/items", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/items")>()),
  getItemCode: vi.fn(),
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

const draft: AiDraftInput = {
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
    await generateAutoTags({ ...draft, content: `${"a".repeat(AI_CONTENT_LIMIT)}TAIL` });

    const { input } = create.mock.calls[0][0];
    expect(input).toContain("a".repeat(AI_CONTENT_LIMIT));
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
      error: AI_NEEDS_INPUT,
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

describe("generateDescription", () => {
  beforeEach(() => {
    reply('{"description": "  Debounces a value so effects run only\\n after typing pauses. "}');
  });

  it("returns the description, normalized to one line", async () => {
    expect(await generateDescription(draft)).toEqual({
      success: true,
      data: { description: "Debounces a value so effects run only after typing pauses." },
      error: null,
    });
  });

  it("calls the Responses API with the description instructions and the item", async () => {
    await generateDescription(draft);

    const [request, options] = create.mock.calls[0];
    expect(request).toMatchObject({
      model: AI_MODEL,
      instructions: DESCRIPTION_INSTRUCTIONS,
      text: { format: { type: "json_object" } },
      store: false,
      safety_identifier: getSafetyIdentifier("user-1"),
    });
    expect(request.input).toMatch(/json/i);
    expect(request.input).toContain("<title>useDebounce hook</title>");
    expect(options).toEqual({ timeout: 15_000 });
  });

  it("describes a file from its title and file name", async () => {
    await generateDescription({
      typeName: "file",
      title: "Q3 report",
      fileName: "q3-report.pdf",
    });

    const { input } = create.mock.calls[0][0];
    expect(input).toContain('<item type="file">');
    expect(input).toContain("<file_name>q3-report.pdf</file_name>");
    expect(input).not.toContain("<content>");
  });

  it("accepts a link with only a URL", async () => {
    expect(
      await generateDescription({ typeName: "link", url: "https://tailwindcss.com/docs" }),
    ).toMatchObject({ success: true });
  });

  it("counts against the same AI limit as tag suggestions", async () => {
    await generateDescription(draft);
    expect(rateLimit).toHaveBeenCalledWith("ai", "user-1");
  });

  it("refuses a Free account while gating is on, before calling", async () => {
    vi.stubEnv("PRO_GATING_ENABLED", "true");
    signIn(false);

    expect(await generateDescription(draft)).toEqual({
      success: false,
      data: null,
      error: AI_PRO_REQUIRED,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a draft with nothing to read", async () => {
    expect(await generateDescription({ typeName: "note", title: " " })).toEqual({
      success: false,
      data: null,
      error: AI_NEEDS_INPUT,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    "",
    "Debounces a value.",
    '{"description": ""}',
    '{"description": "\\"\\""}',
    '{"tags": ["react"]}',
  ])(
    "fails on a reply that isn't a JSON description: %j",
    async (outputText) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      reply(outputText);

      expect(await generateDescription(draft)).toEqual({
        success: false,
        data: null,
        error: AI_DESCRIPTION_FAILED,
      });
    },
  );

  it("answers unavailable for an account out of credits", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    create.mockRejectedValue(
      new RateLimitError(429, { type: "insufficient_quota" }, "no credits", new Headers()),
    );

    expect(await generateDescription(draft)).toEqual({
      success: false,
      data: null,
      error: AI_UNAVAILABLE,
    });
  });

  it("answers its own failure message for other errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    create.mockRejectedValue(new InternalServerError(500, undefined, "boom", new Headers()));

    expect(await generateDescription(draft)).toEqual({
      success: false,
      data: null,
      error: AI_DESCRIPTION_FAILED,
    });
  });
});

describe("explainCode", () => {
  const ITEM_ID = "cmtg169y00002zzx5wxanksok";
  const item: ExplainableItem = {
    typeName: "command",
    title: "Prune Docker",
    language: "bash",
    content: "docker system prune -af --volumes",
  };

  beforeEach(() => {
    vi.mocked(getItemCode).mockResolvedValue(item);
    reply("Removes every unused Docker object.\n\n- `-a` also removes unused images.");
  });

  it("returns the explanation as Markdown", async () => {
    expect(await explainCode(ITEM_ID)).toEqual({
      success: true,
      data: { explanation: "Removes every unused Docker object.\n\n- `-a` also removes unused images." },
      error: null,
    });
  });

  it("reads the saved item for the session user and sends all of it as plain text", async () => {
    await explainCode(ITEM_ID);

    expect(getItemCode).toHaveBeenCalledWith("user-1", ITEM_ID);
    const [request, options] = create.mock.calls[0];
    expect(request).toMatchObject({
      model: AI_MODEL,
      instructions: EXPLAIN_INSTRUCTIONS,
      text: { format: { type: "text" } },
      reasoning: { effort: "low" },
      max_output_tokens: 2_000,
      store: false,
      safety_identifier: getSafetyIdentifier("user-1"),
    });
    expect(request.input).toContain('<item type="command" language="bash">');
    expect(request.input).toContain("<title>Prune Docker</title>");
    expect(request.input).toContain("docker system prune -af --volumes");
    expect(options).toEqual({ timeout: 30_000 });
  });

  it("sends code right at the limit whole", async () => {
    vi.mocked(getItemCode).mockResolvedValue({ ...item, content: `${"a".repeat(AI_EXPLAIN_LIMIT - 4)}TAIL` });

    await explainCode(ITEM_ID);
    expect(create.mock.calls[0][0].input).toContain("TAIL");
  });

  it("counts against the same AI limit as the other features", async () => {
    await explainCode(ITEM_ID);
    expect(rateLimit).toHaveBeenCalledWith("ai", "user-1");
  });

  it("refuses a signed-out request without reading the item", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await explainCode(ITEM_ID)).toEqual({ success: false, data: null, error: SESSION_EXPIRED });
    expect(getItemCode).not.toHaveBeenCalled();
  });

  it("refuses a Free account while gating is on, before reading or calling", async () => {
    vi.stubEnv("PRO_GATING_ENABLED", "true");
    signIn(false);

    expect(await explainCode(ITEM_ID)).toEqual({ success: false, data: null, error: AI_PRO_REQUIRED });
    expect(getItemCode).not.toHaveBeenCalled();
    expect(rateLimit).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("answers unavailable when no key is set", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    expect(await explainCode(ITEM_ID)).toEqual({ success: false, data: null, error: AI_UNAVAILABLE });
    expect(getItemCode).not.toHaveBeenCalled();
  });

  it("rejects a malformed id without a query", async () => {
    expect(await explainCode("not-a-cuid")).toEqual({ success: false, data: null, error: ITEM_NOT_FOUND });
    expect(getItemCode).not.toHaveBeenCalled();
  });

  it.each<[string, ExplainableItem | null, string]>([
    ["someone else's or a missing item", null, ITEM_NOT_FOUND],
    ["a note", { ...item, typeName: "note" }, EXPLAIN_WRONG_TYPE],
    ["a link", { ...item, typeName: "link" }, EXPLAIN_WRONG_TYPE],
    ["blank code", { ...item, content: "  \n " }, EXPLAIN_NO_CODE],
    ["code over the limit", { ...item, content: "a".repeat(AI_EXPLAIN_LIMIT + 1) }, EXPLAIN_TOO_LONG],
  ])("refuses %s without spending quota", async (_label, found, error) => {
    vi.mocked(getItemCode).mockResolvedValue(found);

    expect(await explainCode(ITEM_ID)).toEqual({ success: false, data: null, error });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("answers its own failure message when loading the item fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getItemCode).mockRejectedValue(new Error("db down"));

    expect(await explainCode(ITEM_ID)).toEqual({ success: false, data: null, error: AI_EXPLAIN_FAILED });
    expect(create).not.toHaveBeenCalled();
  });

  it("returns the rate-limit message once the hour's requests are used", async () => {
    vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 60_000 });

    const result = await explainCode(ITEM_ID);
    expect(result).toMatchObject({ success: false, data: null });
    expect(result.error).toMatch(/^Too many attempts/);
    expect(create).not.toHaveBeenCalled();
  });

  it.each(["", "   ", "```markdown\n\n```"])("fails on an empty reply: %j", async (outputText) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    reply(outputText);

    expect(await explainCode(ITEM_ID)).toEqual({ success: false, data: null, error: AI_EXPLAIN_FAILED });
  });

  it("answers unavailable for an account out of credits", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    create.mockRejectedValue(
      new RateLimitError(429, { type: "insufficient_quota" }, "no credits", new Headers()),
    );

    expect(await explainCode(ITEM_ID)).toEqual({ success: false, data: null, error: AI_UNAVAILABLE });
  });

  it("answers its own failure message for other errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    create.mockRejectedValue(new InternalServerError(500, undefined, "boom", new Headers()));

    expect(await explainCode(ITEM_ID)).toEqual({ success: false, data: null, error: AI_EXPLAIN_FAILED });
  });
});
