import Link from "next/link";

import { Logo } from "@/components/brand/Logo";
import { HomeNavActions } from "@/components/home/HomeNavActions";
import { HomeContainer } from "@/components/home/HomeSection";
import { NavScrollShell } from "@/components/home/NavScrollShell";
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
        {/* Plain anchors: after a client-side jump from another page to `/#pricing`,
            Next's router appended the next hash (`/#pricing#features`). */}
        <nav aria-label="Main" className="hidden gap-6 text-sm text-muted-foreground md:flex">
          {SECTION_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>
        <HomeNavActions isSignedIn={isSignedIn} start={start} />
      </HomeContainer>
    </NavScrollShell>
  );
}
