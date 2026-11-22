import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/toaster";
import { ServiceWorkerCleanup } from "@/components/sw-cleanup";
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
  title: "After Sales · Ziloty",
  description: "Post-conversion client onboarding and marketplace operations",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${geistSans.className} h-full antialiased`}
      >
        {children}
        <ServiceWorkerCleanup />
        <Toaster />
      </body>
    </html>
  );
}
