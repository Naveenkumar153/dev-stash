import { describe, expect, it, vi } from "vitest";

import { deleteOrphanedTags, tryDeleteOrphanedTags } from "@/lib/db/tags";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: { tag: { deleteMany: vi.fn() } } }));

describe("deleteOrphanedTags", () => {
  it("deletes only those of the given tags that no item uses, in one statement", async () => {
    await deleteOrphanedTags(["tag-1", "tag-2"]);

    expect(prisma.tag.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["tag-1", "tag-2"] }, items: { none: {} } },
    });
  });

  it("runs on a transaction's client when given one", async () => {
    const tx = { tag: { deleteMany: vi.fn() } };

    await deleteOrphanedTags(["tag-1"], tx as never);

    expect(tx.tag.deleteMany).toHaveBeenCalledOnce();
    expect(prisma.tag.deleteMany).not.toHaveBeenCalled();
  });

  it("makes no query for no tags", async () => {
    await deleteOrphanedTags([]);

    expect(prisma.tag.deleteMany).not.toHaveBeenCalled();
  });
});

describe("tryDeleteOrphanedTags", () => {
  it("logs a failure instead of throwing", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.tag.deleteMany).mockRejectedValue(new Error("connection lost"));

    await expect(tryDeleteOrphanedTags(["tag-1"])).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith("Removing unused tags failed", expect.any(Error));
  });
});
