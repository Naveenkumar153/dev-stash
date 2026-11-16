import { HomeButtonLink } from "@/components/home/HomeButtonLink";
import { HomeSection } from "@/components/home/HomeSection";
import { Reveal } from "@/components/home/Reveal";
import { SectionHeader } from "@/components/home/SectionHeader";
import { getStartAction } from "@/lib/homepage";

export function CtaSection({ isSignedIn }: Readonly<{ isSignedIn: boolean }>) {
  const start = getStartAction(isSignedIn, "Get Started Free");

  return (
    <HomeSection className="relative overflow-hidden">
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-105 w-190 -translate-1/2 bg-[radial-gradient(closest-side,rgb(139_92_246/0.16),transparent)]" />
      <Reveal className="relative text-center">
        <SectionHeader
          title="Ready to Organize Your"
          highlight="Developer Knowledge?"
          subtitle="Join the developers who stopped losing their best work."
        />
        <HomeButtonLink href={start.href} size="lg" className="mt-8">
          {start.label}
        </HomeButtonLink>
      </Reveal>
    </HomeSection>
  );
}
