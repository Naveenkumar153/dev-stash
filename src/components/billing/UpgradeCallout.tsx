import Link from "next/link";
import { Sparkles } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { UPGRADE_PATH } from "@/lib/plans";
import { cn } from "@/lib/utils";

interface UpgradeCalloutProps {
  children: React.ReactNode;
}

/** An inline "this is a Pro feature" box with a link to the Billing card. */
export function UpgradeCallout({ children }: Readonly<UpgradeCalloutProps>) {
  return (
    <div
      role="note"
      className="flex flex-col gap-3 rounded-lg border border-dashed px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-start gap-2">
        <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-type-prompt" />
        <span>{children}</span>
      </p>
      <Link href={UPGRADE_PATH} className={cn(buttonVariants({ size: "sm" }), "w-fit shrink-0")}>
        Upgrade to Pro
      </Link>
    </div>
  );
}
