import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

const trip = require("@/lib/data/spain-trip-2026.json");

export const metadata: Metadata = {
  title: trip.hero?.title || "Trip",
  description: trip.hero?.intro || "",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body
        style={
          {
            "--font-display": "var(--font-inter)",
            "--font-text": "var(--font-inter)",
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
