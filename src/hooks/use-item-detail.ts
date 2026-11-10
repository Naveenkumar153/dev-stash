"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ItemDetail, ItemDetailResponse } from "@/types/items";

const LOAD_FAILED = "Couldn't load this item. Please try again.";

export type ItemDetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; item: ItemDetail }
  | { status: "error"; message: string };

/**
 * Loads an item's full detail from `GET /api/items/[id]` on demand. Starting a
 * new load cancels the one in flight, so a slow response for an item the user
 * has already moved on from can never overwrite the current one.
 */
export function useItemDetail() {
  const [detail, setDetail] = useState<ItemDetailState>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const load = useCallback(async (id: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setDetail({ status: "loading" });

    try {
      const response = await fetch(`/api/items/${encodeURIComponent(id)}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const body = (await response.json()) as ItemDetailResponse;
      if (controller.signal.aborted) {
        return;
      }

      setDetail(
        response.ok && body.data
          ? { status: "ready", item: body.data }
          : { status: "error", message: body.error ?? LOAD_FAILED },
      );
    } catch {
      // Aborted on purpose: a newer load owns the state now.
      if (!controller.signal.aborted) {
        setDetail({ status: "error", message: LOAD_FAILED });
      }
    }
  }, []);

  /**
   * Shows an item that's already in hand, such as the one a save returned,
   * cancelling any load still in flight so it can't overwrite it.
   */
  const replace = useCallback((item: ItemDetail) => {
    controllerRef.current?.abort();
    setDetail({ status: "ready", item });
  }, []);

  return { detail, load, replace };
}
