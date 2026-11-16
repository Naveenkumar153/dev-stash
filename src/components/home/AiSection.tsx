import { Check } from "lucide-react";

import { CodeEditorMockup } from "@/components/home/CodeEditorMockup";
import { HomeSection } from "@/components/home/HomeSection";
import { Reveal } from "@/components/home/Reveal";
import { SectionHeader } from "@/components/home/SectionHeader";
import { Badge } from "@/components/ui/badge";
import { AI_CAPABILITIES } from "@/lib/homepage";

export function AiSection() {
  return (
    <HomeSection className="bg-linear-to-b from-background via-card/40 to-background">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
        <Reveal>
          <SectionHeader
            align="left"
            eyebrow={
              <Badge className="h-5.5 px-2.5 text-[11px] font-bold tracking-wide uppercase bg-type-prompt text-white">
                Pro Feature
              </Badge>
            }
            title="AI-Powered"
            highlight="Productivity"
            subtitle="Let AI handle the busywork so you can focus on building."
          />
          <ul className="mt-7 grid gap-3.5 text-[15px] text-foreground/85">
            {AI_CAPABILITIES.map((capability) => (
              <li key={capability} className="flex items-center gap-3">
                <Check aria-hidden className="size-4.5 shrink-0 text-emerald-500" strokeWidth={2.5} />
                {capability}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal>
          <CodeEditorMockup />
        </Reveal>
      </div>
    </HomeSection>
  );
}
