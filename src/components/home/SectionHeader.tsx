import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  /** First line of the heading. */
  title: string;
  /** Second line, in the brand gradient. */
  highlight: string;
  subtitle: string;
  /** Shown above the heading, e.g. a badge. */
  eyebrow?: ReactNode;
  align?: "center" | "left";
  className?: string;
}

/** A homepage section's two-line heading and subtitle. */
export function SectionHeader({
  title,
  highlight,
  subtitle,
  eyebrow,
  align = "center",
  className,
}: Readonly<SectionHeaderProps>) {
  const isCentered = align === "center";

  return (
    <header className={cn(isCentered && "mx-auto max-w-155 text-center", className)}>
      {eyebrow}
      <h2
        className={cn(
          "text-[clamp(30px,4.2vw,42px)] leading-[1.15] font-extrabold tracking-tight",
          eyebrow && "mt-4.5",
        )}
      >
        {title}
        <br />
        <span className="text-gradient">{highlight}</span>
      </h2>
      <p className="mt-4 text-base text-muted-foreground">{subtitle}</p>
    </header>
  );
}
