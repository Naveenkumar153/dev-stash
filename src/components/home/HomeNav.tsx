import Link from "next/link";

import { Logo } from "@/components/brand/Logo";
import { HomeButtonLink } from "@/components/home/HomeButtonLink";
import { HomeContainer } from "@/components/home/HomeSection";
import { NavScrollShell } from "@/components/home/NavScrollShell";
import { SIGN_IN_PATH } from "@/lib/auth-redirect";
import { getStartAction, SECTION_LINKS } from "@/lib/homepage";

/** The homepage's fixed top bar: logo, section links and account actions. */
export function HomeNav({ isSignedIn }: Readonly<{ isSignedIn: boolean }>) {
  const start = getStartAction(isSignedIn, "Get Started");

  return (
    <NavScrollShell>
      <HomeContainer className="flex h-full items-center gap-8">
        <Link href="/">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden gap-6 text-sm text-muted-foreground md:flex">
          {SECTION_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {!isSignedIn && (
            <HomeButtonLink href={SIGN_IN_PATH} tone="ghost" size="sm">
              Sign In
            </HomeButtonLink>
          )}
          <HomeButtonLink href={start.href} size="sm">
            {start.label}
          </HomeButtonLink>
        </div>
      </HomeContainer>
    </NavScrollShell>
  );
}
