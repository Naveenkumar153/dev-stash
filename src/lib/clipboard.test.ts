import { afterEach, describe, expect, it, vi } from "vitest";

import { copyToClipboard } from "@/lib/clipboard";

const { toast } = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("sonner", () => ({ toast }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copyToClipboard", () => {
  it("writes the text and toasts success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await copyToClipboard("npm test");

    expect(writeText).toHaveBeenCalledWith("npm test");
    expect(toast.success).toHaveBeenCalledWith("Copied to clipboard");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("toasts an error when the write is refused", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });

    await copyToClipboard("npm test");

    expect(toast.error).toHaveBeenCalledWith("Couldn't copy to the clipboard.");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("toasts an error when there is no clipboard, as on an insecure origin", async () => {
    vi.stubGlobal("navigator", {});

    await copyToClipboard("npm test");

    expect(toast.error).toHaveBeenCalledWith("Couldn't copy to the clipboard.");
  });
});
