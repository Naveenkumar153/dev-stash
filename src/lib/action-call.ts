import { unstable_rethrow } from "next/navigation";
import { toast } from "sonner";

/** Shown when a server action's request itself fails, e.g. on a dropped connection. */
export const CONNECTION_FAILED = "Couldn't reach DevStash. Check your connection and try again.";

/**
 * Calls a server action from the browser. A request that fails before the
 * action can answer - a dropped connection, a server that's down - would
 * otherwise throw into the error boundary and lose the form; here it toasts
 * and returns null, so the caller just stops. Next's own redirect and
 * not-found signals are passed on untouched.
 */
export async function callAction<T>(action: () => Promise<T>): Promise<T | null> {
  try {
    return await action();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Server action request failed", error);
    toast.error(CONNECTION_FAILED);
    return null;
  }
}
