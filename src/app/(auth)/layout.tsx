import { HomeNav } from "@/components/home/HomeNav";
import { getSessionUserId } from "@/lib/session";

/**
 * Sign in, register and the password pages share the homepage's top nav, so
 * the way back to the marketing pages and between Sign In / Get Started is the
 * same everywhere. The nav is fixed, so the content clears its 56px / 64px.
 */
export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isSignedIn = (await getSessionUserId()) !== null;

  return (
    <>
      <HomeNav isSignedIn={isSignedIn} />
      <main className="flex min-h-svh flex-col items-center justify-center px-4 pt-20 pb-8 sm:pt-24">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </>
  );
}
