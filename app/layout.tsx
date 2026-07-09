import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers";

export const metadata: Metadata = {
  title: "Ma'Maria Cafe & Catering",
  description: "Meniul zilei, noutăți și comenzi online — Ma'Maria Cafe & Catering",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#00818C" };
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700;9..144,900&family=Instrument+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
