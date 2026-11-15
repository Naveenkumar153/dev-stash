"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchSearchData, type SearchDataResult } from "@/lib/search-request";
import type { SearchData } from "@/types/search";

export interface SearchDataState {
  /** The last data loaded; kept while a newer load runs or after one fails. */
  data: SearchData | null;
  /** Why the last load failed while there is no data; null while loading or once any load has succeeded. */
  error: string | null;
}

/**
 * The command palette's data, loaded when the app shell mounts. `refresh()`
 * loads it again in the background - the palette calls it on every open, so
 * items and collections created, edited or deleted since still show correctly,
 * while the previous data stays on screen until the new data arrives. Each
 * refresh cancels the one before it, so a slow reply can't overwrite a newer
 * one.
 */
export function useSearchData() {
  const [state, setState] = useState<SearchDataState>({ data: null, error: null });
  const controllerRef = useRef<AbortController | null>(null);

  /** Starts a load, cancelling the one before it. Sets no state itself. */
  const startLoad = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    return fetchSearchData({ signal: controller.signal }).then((result) => ({
      result,
      aborted: controller.signal.aborted,
    }));
  }, []);

  const applyLoad = useCallback(
    ({ result, aborted }: { result: SearchDataResult; aborted: boolean }) => {
      if (aborted) {
        return;
      }

      setState((previous) =>
        result.ok
          ? { data: result.data, error: null }
          : // A failed refresh keeps data that loaded earlier.
            { data: previous.data, error: previous.data ? null : result.message },
      );
    },
    [],
  );

  /** Reloads in the background. Called from event handlers, not effects. */
  const refresh = useCallback(() => {
    // Back to "loading" if only an error is showing, so it doesn't read as
    // the answer to the retry that's now running.
    setState((previous) => (previous.error ? { data: null, error: null } : previous));
    void startLoad().then(applyLoad);
  }, [startLoad, applyLoad]);

  useEffect(() => {
    void startLoad().then(applyLoad);

    return () => controllerRef.current?.abort();
  }, [startLoad, applyLoad]);

  return { ...state, refresh };
}
