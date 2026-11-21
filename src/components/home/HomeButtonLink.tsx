import type { ReactNode } from "react";

import { ButtonLink } from "@/components/common/ButtonLink";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "h-8.5 px-3.5 text-[13px]",
  md: "h-10 px-4.5",
  lg: "h-11.5 px-6 text-[15px]",
} as const;

const TONES = {
  brand: {
    variant: "default",
    className:
      "bg-brand-gradient text-white hover:-translate-y-px hover:shadow-lg hover:shadow-indigo-500/30",
  },
  outline: { variant: "outline", className: "" },
  ghost: { variant: "ghost", className: "text-muted-foreground" },
} as const;

interface HomeButtonLinkProps {
  href: string;
  children: ReactNode;
  tone?: keyof typeof TONES;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

/**
 * A link styled as the homepage's buttons: `ButtonLink` at the mockup's larger
 * sizes, plus the brand gradient for primary actions.
 */
export function HomeButtonLink({
  href,
  children,
  tone = "brand",
  size = "md",
  className,
}: Readonly<HomeButtonLinkProps>) {
  const { variant, className: toneClassName } = TONES[tone];

  return (
    <ButtonLink
      href={href}
      variant={variant}
      className={cn("font-semibold", SIZE_CLASSES[size], toneClassName, className)}
    >
      {children}
    </ButtonLink>
  );
}
