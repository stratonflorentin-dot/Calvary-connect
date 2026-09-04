import { Barlow, Barlow_Condensed } from "next/font/google";

// Self-hosted at build time by next/font, same mechanism the app-wide
// Space Grotesk load already uses in src/app/layout.tsx — no runtime
// requests to fonts.googleapis.com. Scoped to .cc-industry via these CSS
// variables rather than applied at the <html> level, since the rest of the
// app keeps Space Grotesk.
export const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-barlow",
});

export const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-barlow-condensed",
});

export const industryFontVariables = `${barlow.variable} ${barlowCondensed.variable}`;
