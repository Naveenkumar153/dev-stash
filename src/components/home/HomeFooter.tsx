import Link from "next/link";

import { Logo } from "@/components/brand/Logo";
import { HomeContainer } from "@/components/home/HomeSection";
import { getFooterColumns } from "@/lib/homepage";

export function HomeFooter({ isSignedIn }: Readonly<{ isSignedIn: boolean }>) {
  return (
    <footer className="border-t bg-card/30 pt-16 pb-8 text-sm">
      <HomeContainer>
        <div className="grid grid-cols-2 gap-10 md:grid-cols-[2fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <Link href="/">
              <Logo />
            </Link>
            <p className="mt-3.5 max-w-70 text-muted-foreground">
              Your developer knowledge hub. One place for snippets, prompts, commands, and more.
            </p>
          </div>
          {getFooterColumns(isSignedIn).map((column) => (
            <nav key={column.title} aria-label={column.title} className="flex flex-col gap-2.5">
              <p className="mb-1 text-xs font-bold tracking-widest uppercase">{column.title}</p>
              {column.links.map((link) => {
                // Section anchors stay plain links, like the nav's (see HomeNav).
                const Anchor = link.href.includes("#") ? "a" : Link;

                return (
                  <Anchor
                    key={link.href}
                    href={link.href}
                    className="w-fit text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Anchor>
                );
              })}
            </nav>
          ))}
        </div>
        <p className="mt-12 border-t pt-6 text-center text-[13px] text-muted-foreground">
          &copy; {new Date().getFullYear()} DevStash. All rights reserved.
        </p>
      </HomeContainer>
    </footer>
  );
}
