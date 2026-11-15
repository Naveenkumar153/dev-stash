"use client";

import { useEffect, useState } from "react";

import { fetchCollectionOptions } from "@/lib/collection-request";
import type { CollectionOption } from "@/types/collections";

export type CollectionOptionsState =
  | { status: "loading" }
  | { status: "ready"; collections: CollectionOption[] }
  | { status: "error"; message: string };

/**
 * The signed-in user's collections, loaded once when the calling form mounts,
 * so every open of the New Item dialog or the drawer's edit form lists
 * collections created since. The request is cancelled if the form unmounts.
 */
export function useCollectionOptions(): CollectionOptionsState {
  const [state, setState] = useState<CollectionOptionsState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    fetchCollectionOptions({ signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      setState(
        result.ok
          ? { status: "ready", collections: result.collections }
          : { status: "error", message: result.message },
      );
    });

    return () => controller.abort();
  }, []);

  return state;
}
