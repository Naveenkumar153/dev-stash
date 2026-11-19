import { unstable_rethrow } from "next/navigation";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";

import { CONNECTION_FAILED, callAction } from "@/lib/action-call";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));

describe("callAction", () => {
  it("returns the action's own result, failures included, without a toast", async () => {
    const result = { success: false, error: "Title is required" };

    expect(await callAction(async () => result)).toBe(result);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("toasts and returns null when the request itself fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const dropped = new TypeError("Failed to fetch");

    expect(await callAction(() => Promise.reject(dropped))).toBeNull();
    expect(unstable_rethrow).toHaveBeenCalledWith(dropped);
    expect(toast.error).toHaveBeenCalledWith(CONNECTION_FAILED);
  });

  it("lets Next's redirect signal through instead of toasting it", async () => {
    const redirectSignal = new Error("NEXT_REDIRECT");
    vi.mocked(unstable_rethrow).mockImplementation((error) => {
      throw error;
    });

    await expect(callAction(() => Promise.reject(redirectSignal))).rejects.toBe(redirectSignal);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
