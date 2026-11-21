"use client";

import { Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";

import { ButtonLink } from "@/components/common/ButtonLink";
import { UPGRADE_PATH } from "@/lib/plans";

/**
 * The top bar's Upgrade link for Free users, to /upgrade. A muted ghost button,
 * quieter than the filled "+ New"; its word shows once the bar has 22rem of room
 * and the icon carries it below that. A plain link styled as a button, since
 * Base UI's Button would add role="button".
 */
export function UpgradeLink() {
  const active = usePathname() === UPGRADE_PATH;

  return (
    <ButtonLink
      href={UPGRADE_PATH}
      aria-label="Upgrade to Pro"
      aria-current={active ? "page" : undefined}
      variant="ghost"
      size="lg"
      className="w-9 px-0 text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground @[22rem]/topbar:w-auto @[22rem]/topbar:px-2.5"
    >
      <Sparkles aria-hidden className="text-violet-400" />
      <span className="hidden @[22rem]/topbar:inline">Upgrade</span>
    </ButtonLink>
  );
}
