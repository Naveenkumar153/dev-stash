import { toast } from "sonner";

const COPY_FAILED = "Couldn't copy to the clipboard.";

/**
 * Puts `text` on the clipboard and toasts how it went. Shared by the item
 * drawer's Copy button and the code editor's.
 */
export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  } catch {
    // No clipboard access: an insecure origin or a denied permission.
    toast.error(COPY_FAILED);
  }
}

/** Rejects a pending copy with a message meant for the user, e.g. "nothing to copy". */
export class CopyTextError extends Error {}

/**
 * Copies text that is still being fetched, e.g. a card's content loaded on
 * click. Safari only allows a clipboard write that starts inside the click, so
 * where `ClipboardItem` exists the write starts at once with the pending text
 * as its data; elsewhere `writeText` runs once the text arrives. A
 * `CopyTextError` from `pending` is toasted as is, anything else generically.
 */
export async function copyPendingText(pending: Promise<string>) {
  // ClipboardItem can swap the text's own rejection for a DOMException, so keep it here.
  const failure: { error?: unknown } = {};
  const text = pending.catch((error: unknown) => {
    failure.error = error;
    throw error;
  });
  // Marks the rejection handled when the clipboard fails before reading it.
  text.catch(() => undefined);

  try {
    if (typeof ClipboardItem === "function" && navigator.clipboard?.write) {
      const blob = text.then((value) => new Blob([value], { type: "text/plain" }));
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
    } else {
      const value = await text;
      await navigator.clipboard.writeText(value);
    }
    toast.success("Copied to clipboard");
  } catch {
    toast.error(failure.error instanceof CopyTextError ? failure.error.message : COPY_FAILED);
  }
}
