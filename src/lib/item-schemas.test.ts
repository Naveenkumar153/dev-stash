import { describe, expect, it } from "vitest";

import { itemIdSchema, parseTagInput, updateItemSchema } from "@/lib/item-schemas";

const URL_ERROR = "Enter a full URL starting with http:// or https://";

function parse(input: Record<string, unknown>) {
  return updateItemSchema.safeParse({ title: "useDebounce hook", tags: [], ...input });
}

describe("parseTagInput", () => {
  it("splits on commas and trims each name", () => {
    expect(parseTagInput(" react,hooks ,  typescript ")).toEqual(["react", "hooks", "typescript"]);
  });

  it("drops blank entries", () => {
    expect(parseTagInput("react, , ,hooks,")).toEqual(["react", "hooks"]);
    expect(parseTagInput("   ")).toEqual([]);
    expect(parseTagInput("")).toEqual([]);
  });

  it("keeps each name once, in the order typed", () => {
    expect(parseTagInput("hooks, react, hooks")).toEqual(["hooks", "react"]);
  });

  it("keeps the case as typed", () => {
    expect(parseTagInput("React, react")).toEqual(["React", "react"]);
  });
});

describe("updateItemSchema", () => {
  it("trims the title", () => {
    expect(parse({ title: "  useDebounce hook  " }).data?.title).toBe("useDebounce hook");
  });

  it("requires a title", () => {
    expect(parse({ title: "   " }).error?.issues[0]).toMatchObject({
      path: ["title"],
      message: "Title is required",
    });
    expect(updateItemSchema.safeParse({ tags: [] }).error?.issues[0]).toMatchObject({
      path: ["title"],
      message: "Title is required",
    });
  });

  it("saves blank or missing optional fields as null", () => {
    expect(parse({ description: "   ", language: "", url: "  " }).data).toMatchObject({
      description: null,
      content: null,
      language: null,
      url: null,
    });
  });

  it("accepts null for the optional fields", () => {
    expect(parse({ description: null, content: null, language: null, url: null }).success).toBe(true);
  });

  it("trims the description and language", () => {
    expect(parse({ description: "  A custom hook  ", language: " typescript " }).data).toMatchObject({
      description: "A custom hook",
      language: "typescript",
    });
  });

  it("keeps content exactly as typed, indentation and trailing newline included", () => {
    const content = "  const delay = 300;\n    return delay;\n";

    expect(parse({ content }).data?.content).toBe(content);
  });

  it("saves whitespace-only content as null", () => {
    expect(parse({ content: " \n\t " }).data?.content).toBeNull();
  });

  it.each(["https://tailwindcss.com/docs", "http://localhost:3000/docs", "http://127.0.0.1:8080"])(
    "accepts the http(s) URL %s",
    (url) => {
      expect(parse({ url }).data?.url).toBe(url);
    },
  );

  it("trims the URL", () => {
    expect(parse({ url: "  https://ui.shadcn.com  " }).data?.url).toBe("https://ui.shadcn.com");
  });

  it.each(["javascript:alert(1)", "ftp://files.example.com", "mailto:dev@example.com", "not a url"])(
    "rejects %s",
    (url) => {
      expect(parse({ url }).error?.issues[0]).toMatchObject({ path: ["url"], message: URL_ERROR });
    },
  );

  it("trims tag names and keeps each once", () => {
    expect(parse({ tags: [" react", "react ", "hooks"] }).data?.tags).toEqual(["react", "hooks"]);
  });

  it("rejects a blank tag", () => {
    expect(parse({ tags: ["react", "  "] }).error?.issues[0]).toMatchObject({
      path: ["tags", 1],
      message: "Tags can't be blank",
    });
  });

  it("requires the tags array, so a missing one can't wipe the tags", () => {
    expect(updateItemSchema.safeParse({ title: "Hook" }).error?.issues[0]).toMatchObject({
      path: ["tags"],
      message: "Tags are required",
    });
  });
});

describe("itemIdSchema", () => {
  it("accepts a Prisma cuid", () => {
    expect(itemIdSchema.safeParse("cmtg169y00002zzx5wxanksok").success).toBe(true);
  });

  it.each(["", "not-a-cuid", "12345"])("rejects %j", (id) => {
    expect(itemIdSchema.safeParse(id).success).toBe(false);
  });
});
