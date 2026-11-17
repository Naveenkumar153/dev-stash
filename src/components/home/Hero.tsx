import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { ChaosIcons } from "@/components/home/ChaosIcons";
import { DashboardPreview } from "@/components/home/DashboardPreview";
import { HomeButtonLink } from "@/components/home/HomeButtonLink";
import { HomeContainer } from "@/components/home/HomeSection";
import { Reveal } from "@/components/home/Reveal";
import { FEATURES_ANCHOR, getStartAction } from "@/lib/homepage";

function HeroPanel({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-3 text-center text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </figcaption>
      {children}
    </figure>
  );
}

/** Points right between the panels, and down once they stack. */
function TransformArrow() {
  return (
    <div
      aria-hidden
      className="grid size-13 place-items-center justify-self-center rounded-full border bg-card text-indigo-400 motion-safe:animate-arrow-pulse-down md:mt-5.75 md:self-center md:motion-safe:animate-arrow-pulse"
    >
      <ArrowRight className="size-6 rotate-90 md:rotate-0" />
    </div>
  );
}

/** Headline, calls to action and the "chaos to order" visual. */
export function Hero({ isSignedIn }: Readonly<{ isSignedIn: boolean }>) {
  const start = getStartAction(isSignedIn, "Get Started Free");

  return (
    <section className="relative overflow-hidden pt-28 pb-16 sm:pt-38">
      <div className="pointer-events-none absolute -top-60 left-1/2 h-150 w-225 -translate-x-1/2 bg-[radial-gradient(closest-side,rgb(99_102_241/0.16),transparent)]" />
      <HomeContainer>
        <Reveal className="relative mx-auto max-w-170 text-center">
          <h1 className="text-[clamp(36px,6vw,60px)] leading-[1.08] font-extrabold tracking-[-0.035em]">
            Stop Losing Your
            <br />
            <span className="text-gradient">Developer Knowledge</span>
          </h1>
          <p className="mx-auto mt-5.5 max-w-140 text-base text-muted-foreground sm:text-[17px]">
            Your snippets, prompts, commands, and notes are scattered across Notion, GitHub, Slack,
            and a dozen browser tabs. DevStash brings them all into one fast, searchable hub.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 max-sm:*:flex-1 max-sm:*:basis-full">
            <HomeButtonLink href={start.href} size="lg">
              {start.label}
            </HomeButtonLink>
            <HomeButtonLink href={`#${FEATURES_ANCHOR}`} tone="outline" size="lg">
              See Features
            </HomeButtonLink>
          </div>
        </Reveal>

        <Reveal className="relative mx-auto mt-14 grid max-w-240 grid-cols-1 items-end gap-5 sm:mt-18 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-7">
          <HeroPanel label="Your knowledge today...">
            <ChaosIcons />
          </HeroPanel>
          <TransformArrow />
          <HeroPanel label="...with DevStash">
            <DashboardPreview />
          </HeroPanel>
        </Reveal>
      </HomeContainer>
    </section>
  );
}
