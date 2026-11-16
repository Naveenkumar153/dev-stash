import type { Metadata } from "next";

import { AiSection } from "@/components/home/AiSection";
import { CtaSection } from "@/components/home/CtaSection";
import { FeaturesSection } from "@/components/home/FeaturesSection";
import { Hero } from "@/components/home/Hero";
import { HomeFooter } from "@/components/home/HomeFooter";
import { HomeNav } from "@/components/home/HomeNav";
import { PricingSection } from "@/components/home/PricingSection";
import { getSessionUserId } from "@/lib/session";

export const metadata: Metadata = {
  title: "DevStash | Your Developer Knowledge Hub",
};

/**
 * The public marketing homepage. Reads the session once so every "get started"
 * link points at registration, or at the dashboard for a signed-in visitor.
 */
export default async function HomePage() {
  const isSignedIn = (await getSessionUserId()) !== null;

  return (
    <>
      <a
        href="#main"
        className="sr-only z-100 rounded-lg bg-muted px-3.5 py-2 text-sm focus:not-sr-only focus:fixed focus:top-3 focus:left-4"
      >
        Skip to content
      </a>
      <HomeNav isSignedIn={isSignedIn} />
      <main id="main">
        <Hero isSignedIn={isSignedIn} />
        <FeaturesSection />
        <AiSection />
        <PricingSection isSignedIn={isSignedIn} />
        <CtaSection isSignedIn={isSignedIn} />
      </main>
      <HomeFooter isSignedIn={isSignedIn} />
    </>
  );
}
