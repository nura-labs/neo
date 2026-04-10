import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/contexts/auth-context";
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
  title: "Neo — The Behavioral Memory Layer",
  description: "Neo captures how your team builds and makes that knowledge available to every AI agent. By Nura Labs.",
  metadataBase: new URL("https://neo.nura.sh"),
  openGraph: {
    title: "Neo — The Behavioral Memory Layer",
    description: "Neo captures how your team builds and makes that knowledge available to every AI agent. Your patterns, conventions, and decisions — persistent across every session.",
    url: "https://neo.nura.sh",
    siteName: "Neo by Nura Labs",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Neo — The Behavioral Memory Layer",
    description: "Neo captures how your team builds and makes that knowledge available to every AI agent. By Nura Labs.",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
