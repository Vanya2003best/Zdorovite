import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeaderGate from "@/components/HeaderGate";
import "./globals.css";

// Pathname-based hide rules mirrored from Header.tsx and Footer.tsx so
// the public chrome flips visibility immediately on client-side navigation
// (Server Components in the root layout are cached and otherwise wait for
// a hard refresh to re-evaluate). Patterns must be plain strings here —
// RegExp instances can't be serialized across the Server → Client
// Component boundary; HeaderGate compiles them on the client.
const HIDDEN_PREFIXES = ["/studio", "/account"];
const HIDDEN_EXACT = ["/login"];
const HIDDEN_PATTERNS = [
  // /register and /register/<anything>
  "^/register(/|$)",
  // /trainers/<slug> exactly
  "^/trainers/[^/]+$",
  // /trainers/<slug>/<pageSlug> — but NOT /book or /gallery sub-routes
  "^/trainers/[^/]+/(?!book(?:/|$)|gallery(?:/|$))[^/]+$",
];

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NaZdrow! — Znajdź idealnego trenera",
  description:
    "Platforma trenerów personalnych NaZdrow!. Znajdź trenera idealnie dopasowanego do Twoich celów: odchudzanie, masa mięśniowa, rehabilitacja, joga i więcej.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[family-name:var(--font-geist-sans)]">
        <HeaderGate
          hiddenPrefixes={HIDDEN_PREFIXES}
          hiddenExact={HIDDEN_EXACT}
          hiddenPatterns={HIDDEN_PATTERNS}
        >
          <Header />
        </HeaderGate>
        <main className="flex-1">{children}</main>
        {/* Footer mirrors the Header's hide rules via HeaderGate (same
            patterns) so the public chrome stays in lockstep across
            client navigations. Footer also runs its own server-side
            x-pathname check internally for booking/checkout flows
            (transactional pages where a marketing footer would be a
            distraction) — that's an additive filter on top of the
            HeaderGate rules. */}
        <HeaderGate
          hiddenPrefixes={HIDDEN_PREFIXES}
          hiddenExact={HIDDEN_EXACT}
          hiddenPatterns={HIDDEN_PATTERNS}
        >
          <Footer />
        </HeaderGate>
      </body>
    </html>
  );
}
