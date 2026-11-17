import { Layers } from "lucide-react";

import { cn } from "@/lib/utils";

interface LogoProps {
  /** Hide the wordmark, e.g. in the sidebar's collapsed icon rail. */
  showName?: boolean;
  className?: string;
}

/**
 * The DevStash mark (a `Layers` tile in the sidebar's blue, so the brand looks
 * the same before and after sign-in) and wordmark. Callers wrap it in a link.
 */
export function Logo({ showName = true, className }: Readonly<LogoProps>) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Layers aria-hidden className="size-5" />
      </span>
      {showName && <span className="font-heading text-lg font-semibold">DevStash</span>}
    </span>
  );
}
