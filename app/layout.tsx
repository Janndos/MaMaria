import type { Metadata, Viewport } from "next";
import { Fraunces, Inter_Tight } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers";

// Self-hosted at build time (no runtime request to Google). Weights 400/500 carry
// the redesigned surfaces; 600/700 remain for the rest of the app's existing type.
const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});
const interTight = Inter_Tight({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter-tight",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ma'Maria Cafe & Catering",
  description: "Meniul zilei, noutăți și comenzi online — Ma'Maria Cafe & Catering",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#00818C" };
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${fraunces.variable} ${interTight.variable}`}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
