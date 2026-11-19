import { describe, expect, it } from "vitest";

import {
  createFileItemSchema,
  createItemSchema,
  itemIdSchema,
  updateItemSchema,
} from "@/lib/item-schemas";

const URL_ERROR = "Enter a full URL starting with http:// or https://";

function parse(input: Record<string, unknown>) {
  return updateItemSchema.safeParse({ title: "useDebounce hook", tags: [], collectionIds: [], ...input });
}

describe("updateItemSchema", () => {
  describe("length limits", () => {
    function firstIssue(input: Record<string, unknown>) {
      return parse(input).error?.issues[0];
    }

    it.each([
      ["title", 200, "Title can be up to 200 characters"],
      ["description", 2000, "Description can be up to 2,000 characters"],
      ["language", 50, "Language can be up to 50 characters"],
    ])("caps %s at %i characters", (field, max, message) => {
      expect(parse({ [field]: "x".repeat(max) }).success).toBe(true);
      expect(firstIssue({ [field]: "x".repeat(max + 1) })).toMatchObject({ path: [field], message });
    });

    it("measures the cap after trimming", () => {
      expect(parse({ title: `  ${"x".repeat(200)}  ` }).success).toBe(true);
    });

    it("caps content at 100,000 characters, counting whitespace since it's kept", () => {
      expect(parse({ content: "x".repeat(100_000) }).success).toBe(true);
      expect(firstIssue({ content: "x".repeat(100_001) })).toMatchObject({
        path: ["content"],
        message: "Content can be up to 100,000 characters",
      });
    });

    it("caps a URL at 2,048 characters", () => {
      const url = (length: number) => `https://example.com/${"a".repeat(length - 20)}`;
      expect(parse({ url: url(2048) }).success).toBe(true);
      expect(firstIssue({ url: url(2049) })).toMatchObject({ path: ["url"] });
    });

    it("caps each tag at 50 characters", () => {
      expect(firstIssue({ tags: ["x".repeat(51)] })).toMatchObject({
        path: ["tags", 0],
        message: "Tags can be up to 50 characters each",
      });
    });

    it("allows 20 tags, counted after duplicates are dropped", () => {
      const tags = Array.from({ length: 20 }, (_, index) => `tag-${index}`);
      expect(parse({ tags: [...tags, "tag-0"] }).data?.tags).toHaveLength(20);
      expect(firstIssue({ tags: [...tags, "one-more"] })).toMatchObject({
        path: ["tags"],
        message: "Add up to 20 tags",
      });
    });
  });

  describe("collectionIds", () => {
    const COLLECTION_A = "cmcollectreact0000000001";
    const COLLECTION_B = "cmcollectdocs00000000002";

    it("keeps each collection once, in the order given", () => {
      expect(
        parse({ collectionIds: [COLLECTION_B, COLLECTION_A, COLLECTION_B] }).data?.collectionIds,
      ).toEqual([COLLECTION_B, COLLECTION_A]);
    });

    it("accepts no collections", () => {
      expect(parse({ collectionIds: [] }).data?.collectionIds).toEqual([]);
    });

    it("requires the list, so an edit can't clear an item's collections by leaving it out", () => {
      expect(parse({ collectionIds: undefined }).error?.issues[0]).toMatchObject({
        path: ["collectionIds"],
        message: "Choose collections from the list",
      });
    });

    it("rejects an id that isn't a cuid", () => {
      expect(parse({ collectionIds: [COLLECTION_A, "1; DROP"] }).error?.issues[0]).toMatchObject({
        path: ["collectionIds", 1],
        message: "Choose collections from the list",
      });
    });
  });

  it("trims the title", () => {
    expect(parse({ title: "  useDebounce hook  " }).data?.title).toBe("useDebounce hook");
  });

  it("requires a title", () => {
    expect(parse({ title: "   " }).error?.issues[0]).toMatchObject({
      path: ["title"],
      message: "Title is required",
    });
    expect(updateItemSchema.safeParse({ tags: [], collectionIds: [] }).error?.issues[0]).toMatchObject({
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

describe("createItemSchema", () => {
  function parseNew(input: Record<string, unknown>) {
    return createItemSchema.safeParse({ title: "New item", tags: [], collectionIds: [], ...input });
  }

  it.each(["snippet", "prompt", "command", "note"])("creates a %s without a URL", (typeName) => {
    expect(parseNew({ typeName }).success).toBe(true);
  });

  it("creates a link with an http(s) URL", () => {
    expect(parseNew({ typeName: "link", url: "https://nextjs.org" }).data?.url).toBe("https://nextjs.org");
  });

  it.each([undefined, "", "   "])("requires a link's URL (%j)", (url) => {
    expect(parseNew({ typeName: "link", url }).error?.issues[0]).toMatchObject({
      path: ["url"],
      message: "URL is required",
    });
  });

  it("still rejects a link's non-http URL", () => {
    expect(parseNew({ typeName: "link", url: "javascript:alert(1)" }).error?.issues[0]).toMatchObject({
      path: ["url"],
      message: URL_ERROR,
    });
  });

  it.each(["file", "image", "recipe", undefined])("rejects the type %j", (typeName) => {
    expect(parseNew({ typeName }).error?.issues[0]).toMatchObject({
      path: ["typeName"],
      message: "Choose an item type",
    });
  });

  it("normalizes the shared fields like the edit schema", () => {
    expect(
      parseNew({ typeName: "note", title: "  Notes  ", description: " ", tags: ["a", "a "] }).data,
    ).toMatchObject({ title: "Notes", description: null, tags: ["a"] });
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

describe("createFileItemSchema", () => {
  function parseFile(input: Record<string, unknown>) {
    return createFileItemSchema.safeParse({ typeName: "image", title: "Diagram", tags: [], collectionIds: [], ...input });
  }

  it.each(["file", "image"])("accepts the %s type", (typeName) => {
    expect(parseFile({ typeName }).success).toBe(true);
  });

  it.each(["snippet", "link", "recipe", undefined])("rejects the type %j", (typeName) => {
    expect(parseFile({ typeName }).error?.issues[0]).toMatchObject({
      path: ["typeName"],
      message: "Choose an item type",
    });
  });

  it("normalizes the shared fields like the other item schemas", () => {
    expect(parseFile({ title: "  Diagram  ", description: "  ", tags: ["docs", " docs "] }).data).toEqual({
      typeName: "image",
      title: "Diagram",
      description: null,
      tags: ["docs"],
      collectionIds: [],
      folderId: null,
    });
  });

  it("requires a title", () => {
    expect(parseFile({ title: "   " }).error?.issues[0]).toMatchObject({
      path: ["title"],
      message: "Title is required",
    });
  });

  it("drops the text payload fields a file item doesn't have", () => {
    const data = parseFile({ content: "x", language: "ts", url: "https://example.com" }).data;

    expect(data).not.toHaveProperty("content");
    expect(data).not.toHaveProperty("language");
    expect(data).not.toHaveProperty("url");
  });
  it.each([undefined, null, "", "   "])("reads the folder %j as the top level", (folderId) => {
    expect(parseFile({ typeName: "file", folderId }).data?.folderId).toBeNull();
  });

  it("puts a file in a folder by its id", () => {
    expect(parseFile({ typeName: "file", folderId: " cmfolderdocs000000000001 " }).data?.folderId).toBe(
      "cmfolderdocs000000000001",
    );
  });

  it("refuses a folder id that isn't a cuid", () => {
    expect(parseFile({ typeName: "file", folderId: "../docs" }).error?.issues[0]).toMatchObject({
      path: ["folderId"],
      message: "This folder doesn't exist or has been deleted.",
    });
  });

  it("refuses a folder for an image, since only files go in folders", () => {
    expect(parseFile({ typeName: "image", folderId: "cmfolderdocs000000000001" }).error?.issues[0]).toMatchObject({
      path: ["folderId"],
      message: "Only files can go in folders",
    });
  });
});
