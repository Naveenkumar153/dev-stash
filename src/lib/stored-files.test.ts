import { describe, expect, it, vi } from "vitest";

import { deleteFile } from "@/lib/r2";
import { discardStoredFiles } from "@/lib/stored-files";

vi.mock("@/lib/r2", () => ({ deleteFile: vi.fn() }));

describe("discardStoredFiles", () => {
  it("removes every file", async () => {
    await discardStoredFiles(["user-1/a.png", "user-1/b.md"]);

    expect(deleteFile).toHaveBeenCalledTimes(2);
    expect(deleteFile).toHaveBeenCalledWith("user-1/a.png");
    expect(deleteFile).toHaveBeenCalledWith("user-1/b.md");
  });

  it("does nothing for no files", async () => {
    await discardStoredFiles([]);

    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("keeps going past a failure, logs each failed key and never throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(deleteFile)
      .mockRejectedValueOnce(new Error("R2 unavailable"))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("timeout"));

    await expect(discardStoredFiles(["k1", "k2", "k3"])).resolves.toBeUndefined();

    expect(deleteFile).toHaveBeenCalledTimes(3);
    expect(log).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith("Discarding stored file failed", {
      key: "k1",
      error: new Error("R2 unavailable"),
    });
    expect(log).toHaveBeenCalledWith("Discarding stored file failed", {
      key: "k3",
      error: new Error("timeout"),
    });
  });
});
