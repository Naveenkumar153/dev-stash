import Link from "next/link";
import { Check } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DASHBOARD_PATH } from "@/lib/auth-redirect";
import { PRO_PLAN_FEATURES } from "@/lib/homepage";
import { getItemTypePlural, getItemTypeStyleByName } from "@/lib/item-types";
import { PRO_PRICES, UPGRADE_PATH, getYearlySavingsPercent } from "@/lib/plans";
import { cn } from "@/lib/utils";

/** What each Pro-only list page offers, keyed by type name. */
const PITCHES: Record<string, string> = {
  file: "Upload PDFs, docs and config files, organize them in folders, and download them anywhere.",
  image: "Upload screenshots, diagrams and mockups, and browse them as a gallery.",
};

const DEFAULT_PITCH = "Upgrade to DevStash Pro to use this item type.";

interface ProFeaturePageProps {
  /** A Pro-only type, e.g. "file". */
  typeName: string;
}

/**
 * Shown in place of a Pro-only list page (/items/files, /items/images) to a
 * user without Pro access, at the same URL inside the app shell.
 */
export function ProFeaturePage({ typeName }: Readonly<ProFeaturePageProps>) {
  const { icon: Icon, colorClass, bgClass } = getItemTypeStyleByName(typeName);
  const plural = getItemTypePlural(typeName);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-6 sm:py-10">
      <header className="flex flex-col items-center gap-4 text-center">
        <span className={cn("flex size-14 items-center justify-center rounded-xl", bgClass)}>
          <Icon aria-hidden className={cn("size-7", colorClass)} />
        </span>
        <div>
          <h1 className="font-heading text-3xl font-semibold">{plural}</h1>
          <p className="mt-2 text-lg font-medium">{plural} are a Pro feature</p>
          <p className="mt-1 text-muted-foreground">{PITCHES[typeName] ?? DEFAULT_PITCH}</p>
        </div>
      </header>

      <Card className="gap-5 px-5 sm:px-6">
        <div>
          <h2 className="font-heading text-lg font-semibold">DevStash Pro</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ${PRO_PRICES.monthly}/month, or ${PRO_PRICES.yearly}/year and save{" "}
            {getYearlySavingsPercent()}%
          </p>
        </div>
        <ul className="grid gap-2.5 text-sm">
          {PRO_PLAN_FEATURES.map(({ label }) => (
            <li key={label} className="flex gap-2.5">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-500" />
              {label}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href={UPGRADE_PATH} className={cn(buttonVariants({ size: "lg" }), "sm:flex-1")}>
            Upgrade to Pro
          </Link>
          <Link
            href={DASHBOARD_PATH}
            className={cn(buttonVariants({ size: "lg", variant: "outline" }), "sm:flex-1")}
          >
            Back to dashboard
          </Link>
        </div>
      </Card>
    </div>
  );
}
