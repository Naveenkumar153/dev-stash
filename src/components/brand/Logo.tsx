import { Layers } from "lucide-react";

import { cn } from "@/lib/utils";

interface LogoProps {
  /** Hide the wordmark, e.g. in the sidebar's collapsed icon rail. */
  showName?: boolean;
  className?: string;
  /** Overrides the tile's colors, e.g. the sidebar's own primary tokens. */
  tileClassName?: string;
}

/** The DevStash mark (a `Layers` tile) and wordmark. Callers wrap it in a link. */
export function Logo({ showName = true, className, tileClassName }: Readonly<LogoProps>) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
          tileClassName,
        )}
      >
        <Layers aria-hidden className="size-5" />
      </span>
      {showName && <span className="font-heading text-lg font-semibold">DevStash</span>}
    </span>
  );
}
