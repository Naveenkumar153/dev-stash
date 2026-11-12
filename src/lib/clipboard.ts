import { toast } from "sonner";

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
    toast.error("Couldn't copy to the clipboard.");
  }
}
