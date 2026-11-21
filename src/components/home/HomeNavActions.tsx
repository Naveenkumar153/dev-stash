"use client";

import { usePathname } from "next/navigation";

import { HomeButtonLink } from "@/components/home/HomeButtonLink";
import { SIGN_IN_PATH } from "@/lib/auth-redirect";
import type { HomeLink } from "@/lib/homepage";

/**
 * The nav's Sign In and Get Started buttons. The auth pages share this nav, so
 * a button that would link to the page already open is left out.
 */
export function HomeNavActions({
  isSignedIn,
  start,
}: Readonly<{ isSignedIn: boolean; start: HomeLink }>) {
  const pathname = usePathname();

  return (
    <div className="ml-auto flex items-center gap-1 sm:gap-2">
      {!isSignedIn && pathname !== SIGN_IN_PATH && (
        <HomeButtonLink href={SIGN_IN_PATH} tone="ghost" size="sm">
          Sign In
        </HomeButtonLink>
      )}
      {pathname !== start.href && (
        <HomeButtonLink href={start.href} size="sm">
          {start.label}
        </HomeButtonLink>
      )}
    </div>
  );
}
