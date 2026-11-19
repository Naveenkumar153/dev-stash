"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { UPGRADE_PATH } from "@/lib/plans";
import { cn } from "@/lib/utils";

/**
 * The top bar's Upgrade link for Free users, to /upgrade. A muted ghost button,
 * quieter than the filled "+ New"; its word shows once the bar has 22rem of room
 * and the icon carries it below that. A plain link styled as a button, since
 * Base UI's Button would add role="button".
 */
export function UpgradeLink() {
  const active = usePathname() === UPGRADE_PATH;

  return (
    <Link
      href={UPGRADE_PATH}
      aria-label="Upgrade to Pro"
      aria-current={active ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: "ghost", size: "lg" }),
        "w-9 px-0 text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground @[22rem]/topbar:w-auto @[22rem]/topbar:px-2.5",
      )}
    >
      <Sparkles aria-hidden className="text-violet-400" />
      <span className="hidden @[22rem]/topbar:inline">Upgrade</span>
    </Link>
  );
}
