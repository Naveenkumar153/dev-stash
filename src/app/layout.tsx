import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DevStash",
  description:
    "One fast, searchable, AI-enhanced hub for all your developer knowledge and resources.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `dark` is hardcoded for now - dark mode is the default and a light-mode
    // toggle is not part of this phase. Smooth scrolling is for the homepage's
    // in-page links; `data-scroll-behavior` keeps route changes instant.
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`dark motion-safe:scroll-smooth ${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="min-h-svh bg-background text-foreground antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
