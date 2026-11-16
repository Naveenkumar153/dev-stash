"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface RevealProps {
  children: ReactNode;
  className?: string;
}

/**
 * Fades its content in the first time it scrolls into view. Marks itself with
 * `data-visible` (a `group/reveal`, so children can animate on it too) rather
 * than holding state, so revealing never re-renders the content. The hidden
 * state lives in the `reveal-pending` variant in `globals.css`, which only
 * applies while scripts run and motion is allowed.
 */
export function Reveal({ children, className }: Readonly<RevealProps>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        element.dataset.visible = "true";
        observer.disconnect();
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "group/reveal transition-[opacity,translate] duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)] reveal-pending:translate-y-6 reveal-pending:opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
