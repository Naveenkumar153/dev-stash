"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";

import {
  formatPreviewCount,
  PREVIEW_CARDS,
  PREVIEW_QUERY,
  previewCardMatches,
} from "@/lib/homepage";
import { getItemTypeStyleByName } from "@/lib/item-types";
import { cn } from "@/lib/utils";

/** Cards settle in one after another once the hero is revealed. */
const SETTLE_DELAYS = [
  "[animation-delay:450ms]",
  "[animation-delay:550ms]",
  "[animation-delay:650ms]",
  "[animation-delay:750ms]",
  "[animation-delay:850ms]",
  "[animation-delay:950ms]",
];

/** A timeout that rejects when the demo unmounts, ending its loop. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * The main column of the hero's dashboard preview. On a loop it types
 * "debounce" into the search bar, dims the cards that don't match, then clears
 * it. Runs only while on screen, with the tab visible and motion allowed.
 */
export function PreviewSearchDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const controller = new AbortController();
    const { signal } = controller;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inView = true;

    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
    });
    observer.observe(root);

    const onMotionChange = () => {
      if (!reducedMotion.matches) return;
      setIsTyping(false);
      setQuery("");
    };
    reducedMotion.addEventListener("change", onMotionChange);

    const whenActive = async () => {
      while (!inView || document.hidden || reducedMotion.matches) await sleep(400, signal);
    };

    const run = async () => {
      await whenActive();
      await sleep(2200, signal); // let the cards settle in first
      for (;;) {
        await whenActive();
        setIsTyping(true);
        await sleep(500, signal);
        for (let i = 1; i <= PREVIEW_QUERY.length; i++) {
          setQuery(PREVIEW_QUERY.slice(0, i));
          await sleep(120 + Math.random() * 80, signal);
        }
        await sleep(2600, signal);
        for (let i = PREVIEW_QUERY.length - 1; i >= 0; i--) {
          setQuery(PREVIEW_QUERY.slice(0, i));
          await sleep(45, signal);
        }
        setIsTyping(false);
        await sleep(3500, signal);
      }
    };

    run().catch(() => {
      // Aborted on unmount.
    });

    return () => {
      controller.abort();
      observer.disconnect();
      reducedMotion.removeEventListener("change", onMotionChange);
    };
  }, []);

  const matches = PREVIEW_CARDS.map((card) => previewCardMatches(card, query));
  const matchCount = matches.filter(Boolean).length;
  const isSearching = query.trim().length > 0;

  return (
    <div ref={ref} className="flex min-w-0 flex-1 flex-col p-3">
      <div className="mb-2.5 flex gap-1.5">
        <span
          className={cn(
            "flex h-5.5 min-w-0 flex-1 items-center gap-1.5 rounded-[5px] border bg-background px-1.5 text-muted-foreground transition-colors duration-200",
            isTyping && "border-type-snippet/60",
          )}
        >
          <Search className="size-2.75 shrink-0" />
          {query ? (
            <span className="whitespace-pre text-foreground">
              {query}
              {isTyping && (
                <span className="ml-px inline-block h-2.75 w-px animate-caret-blink bg-foreground align-[-2px]" />
              )}
            </span>
          ) : (
            <span className="truncate">Search items...</span>
          )}
          <kbd className="ml-auto rounded border bg-muted px-1 font-mono text-[8px]">⌘K</kbd>
        </span>
        <span className="flex h-5.5 shrink-0 items-center gap-0.5 rounded-[5px] bg-brand-gradient px-2 font-semibold text-white">
          <Plus className="size-2.25" />
          New
        </span>
      </div>

      <div className="mb-2 flex justify-between text-[9px] text-muted-foreground">
        <span className="font-semibold text-foreground">Recent items</span>
        <span>{formatPreviewCount(query, matchCount, PREVIEW_CARDS.length)}</span>
      </div>

      <div className="grid flex-1 grid-cols-2 grid-rows-3 gap-2">
        {PREVIEW_CARDS.map((card, i) => {
          const style = getItemTypeStyleByName(card.typeName);
          const isDimmed = !matches[i];
          return (
            <div
              key={card.title}
              className={cn(
                "relative flex min-w-0 flex-col gap-0.75 overflow-hidden rounded-md border bg-muted px-2 pt-2 pb-1.75 transition-[opacity,scale,border-color] duration-300 group-data-visible/reveal:motion-safe:animate-card-settle",
                SETTLE_DELAYS[i],
                isDimmed && "scale-97 opacity-30",
                isSearching && !isDimmed && style.chipBorderClass,
              )}
            >
              <span className={cn("absolute inset-x-0 top-0 h-0.5", style.dotClass)} />
              <strong className="truncate text-[10.5px] font-semibold">{card.title}</strong>
              <span
                className={cn(
                  "truncate",
                  card.isCode
                    ? cn("font-mono text-[8.5px]", style.colorClass)
                    : "text-[9px] text-muted-foreground",
                )}
              >
                {card.detail}
              </span>
              <span className="mt-auto flex gap-0.75">
                {card.tags.map((tag) => (
                  <span
                    key={tag}
                    className={cn("rounded-[3px] px-1 text-[8px] leading-3.25", style.bgClass, style.colorClass)}
                  >
                    {tag}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
