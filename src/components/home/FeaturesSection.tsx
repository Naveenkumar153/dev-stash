import { HomeSection } from "@/components/home/HomeSection";
import { Reveal } from "@/components/home/Reveal";
import { SectionHeader } from "@/components/home/SectionHeader";
import { Card } from "@/components/ui/card";
import { FEATURES, FEATURES_ANCHOR, type HomeFeature } from "@/lib/homepage";
import { getItemTypeStyleByName } from "@/lib/item-types";
import { cn } from "@/lib/utils";

/** Staggers each row of three cards on wide screens. */
const COLUMN_DELAYS = ["", "lg:delay-80", "lg:delay-160"];

function FeatureCard({ feature }: Readonly<{ feature: HomeFeature }>) {
  const { colorClass, bgClass } = getItemTypeStyleByName(feature.typeName);

  return (
    <Card className="h-full gap-0 px-6.5 py-6.5 transition-[translate,box-shadow] duration-250 hover:-translate-y-0.75 hover:shadow-xl hover:ring-foreground/20">
      <span className={cn("mb-5 grid size-10 place-items-center rounded-[9px]", bgClass, colorClass)}>
        <feature.icon aria-hidden className="size-5" />
      </span>
      <h3 className="text-base font-bold">{feature.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {feature.description}
        {feature.shortcut && (
          <>
            {" "}
            <kbd className="rounded border bg-muted px-1.5 py-px font-mono text-[0.85em]">
              {feature.shortcut}
            </kbd>
            .
          </>
        )}
      </p>
    </Card>
  );
}

export function FeaturesSection() {
  return (
    <HomeSection id={FEATURES_ANCHOR}>
      <Reveal>
        <SectionHeader
          title="Everything You Need,"
          highlight="One Place"
          subtitle="Stop context-switching between tools. DevStash keeps all your developer resources organized and searchable."
          className="mb-10 sm:mb-14"
        />
      </Reveal>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, i) => (
          <Reveal key={feature.title} className={COLUMN_DELAYS[i % COLUMN_DELAYS.length]}>
            <FeatureCard feature={feature} />
          </Reveal>
        ))}
      </div>
    </HomeSection>
  );
}
