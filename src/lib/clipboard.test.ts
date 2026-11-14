import { afterEach, describe, expect, it, vi } from "vitest";

import { copyPendingText, copyToClipboard, CopyTextError } from "@/lib/clipboard";

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

describe("copyPendingText", () => {
  function stubClipboardItem() {
    const items: { data: Record<string, Promise<Blob>> }[] = [];
    class FakeClipboardItem {
      constructor(public data: Record<string, Promise<Blob>>) {
        items.push(this);
      }
    }
    vi.stubGlobal("ClipboardItem", FakeClipboardItem);
    return items;
  }

  it("starts the write at once with the pending text as a ClipboardItem", async () => {
    const items = stubClipboardItem();
    const write = vi.fn(async ([item]: { data: Record<string, Promise<Blob>> }[]) => {
      await item.data["text/plain"];
    });
    vi.stubGlobal("navigator", { clipboard: { write, writeText: vi.fn() } });

    await copyPendingText(Promise.resolve("git status"));

    expect(write).toHaveBeenCalledOnce();
    const blob = await items[0].data["text/plain"];
    expect(blob.type).toBe("text/plain");
    expect(await blob.text()).toBe("git status");
    expect(toast.success).toHaveBeenCalledWith("Copied to clipboard");
  });

  it("falls back to writeText once the text arrives when there is no ClipboardItem", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await copyPendingText(Promise.resolve("git status"));

    expect(writeText).toHaveBeenCalledWith("git status");
    expect(toast.success).toHaveBeenCalledWith("Copied to clipboard");
  });

  it("toasts a CopyTextError's own message even when the clipboard replaces the rejection", async () => {
    stubClipboardItem();
    const write = vi.fn(async ([item]: { data: Record<string, Promise<Blob>> }[]) => {
      await item.data["text/plain"].catch(() => {
        throw new Error("NotAllowedError");
      });
    });
    vi.stubGlobal("navigator", { clipboard: { write } });

    await copyPendingText(Promise.reject(new CopyTextError("This item has nothing to copy.")));

    expect(toast.error).toHaveBeenCalledWith("This item has nothing to copy.");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("toasts the generic error for any other failure of the text", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await copyPendingText(Promise.reject(new Error("boom")));

    expect(writeText).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Couldn't copy to the clipboard.");
  });

  it("toasts the generic error when the write is refused", async () => {
    stubClipboardItem();
    vi.stubGlobal("navigator", {
      clipboard: { write: vi.fn().mockRejectedValue(new Error("denied")) },
    });

    await copyPendingText(Promise.resolve("git status"));

    expect(toast.error).toHaveBeenCalledWith("Couldn't copy to the clipboard.");
  });

  it("toasts the generic error when there is no clipboard", async () => {
    vi.stubGlobal("navigator", {});

    await copyPendingText(Promise.resolve("git status"));

    expect(toast.error).toHaveBeenCalledWith("Couldn't copy to the clipboard.");
  });
});
