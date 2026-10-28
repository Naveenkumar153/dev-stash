import Link from "next/link";
import { Layers } from "lucide-react";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-4">
      <Link href="/" className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Layers aria-hidden className="size-5" />
        </span>
        <span className="font-heading text-lg font-semibold">DevStash</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
