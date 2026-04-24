import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "BarberScan — AI hairstyle previews for barbers",
    template: "%s · BarberScan",
  },
  description:
    "Upload a client photo and instantly show them how they'd look with different hairstyles. Built for professional barbers and salons.",
  openGraph: {
    type: "website",
    siteName: "BarberScan",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#0B0B0C",
          colorBackground: "#FAF7F1",
          borderRadius: "0.9rem",
          fontFamily: "var(--font-sans)",
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body className={`${sans.variable} ${display.variable} font-sans`}>
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
