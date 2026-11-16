"use client";

import { useEffect, useRef, type ReactNode } from "react";

const SCROLLED_AFTER = 12;

/**
 * The homepage's fixed header bar. Sets `data-scrolled` once the page moves, so
 * the bar's background turns more opaque; written to the element directly so
 * scrolling doesn't re-render the nav.
 */
export function NavScrollShell({ children }: Readonly<{ children: ReactNode }>) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = ref.current;
    if (!header) return;

    const update = () => {
      header.dataset.scrolled = String(window.scrollY > SCROLLED_AFTER);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });

    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header
      ref={ref}
      className="fixed inset-x-0 top-0 z-50 h-14 border-b border-transparent bg-background/35 backdrop-blur-sm transition-[background-color,border-color,backdrop-filter] duration-300 data-[scrolled=true]:border-border data-[scrolled=true]:bg-background/90 data-[scrolled=true]:backdrop-blur-md sm:h-16"
    >
      {children}
    </header>
  );
}
