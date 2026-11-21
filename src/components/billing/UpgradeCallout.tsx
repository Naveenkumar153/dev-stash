import { Sparkles } from "lucide-react";

import { ButtonLink } from "@/components/common/ButtonLink";
import { UPGRADE_PATH } from "@/lib/plans";

interface UpgradeCalloutProps {
  children: React.ReactNode;
}

/** An inline "this is a Pro feature" box with a link to the upgrade page. */
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
      <ButtonLink href={UPGRADE_PATH} size="sm" className="w-fit shrink-0">
        Upgrade to Pro
      </ButtonLink>
    </div>
  );
}
