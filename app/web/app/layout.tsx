import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";

const geistSans = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  display: "swap",
  weight: "100 900",
});

const manrope = localFont({
  src: "./fonts/manrope-latin.woff2",
  variable: "--font-manrope",
  display: "swap",
  weight: "200 800",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Current",
  description: "Your personal finance dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", manrope.variable)}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster
          position="bottom-left"
          toastOptions={{
            style: {
              background: "#16213E",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#ffffff",
              fontFamily: "var(--font-manrope)",
              fontSize: "13px",
              fontWeight: 500,
              borderRadius: "14px",
            },
            classNames: {
              success: "!text-[#3ecf8e]",
              error: "!text-white/70",
            },
          }}
        />
      </body>
    </html>
  );
}
