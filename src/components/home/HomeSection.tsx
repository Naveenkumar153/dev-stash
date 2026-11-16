import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** The homepage's centered content column. */
export function HomeContainer({
  children,
  className,
}: Readonly<{ children: ReactNode; className?: string }>) {
  return <div className={cn("mx-auto w-full max-w-280 px-4 sm:px-6", className)}>{children}</div>;
}

interface HomeSectionProps {
  children: ReactNode;
  id?: string;
  className?: string;
}

/** A full-width homepage section; anchored ones clear the fixed nav when scrolled to. */
export function HomeSection({ children, id, className }: Readonly<HomeSectionProps>) {
  return (
    <section id={id} className={cn("scroll-mt-14 py-20 sm:scroll-mt-16 sm:py-28", className)}>
      <HomeContainer>{children}</HomeContainer>
    </section>
  );
}
