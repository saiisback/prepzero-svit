import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getSession } from "@/lib/auth-guard";
import { Providers } from "@/providers";
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
  title: "PrepZero - College Placement Test Platform",
  description: "Online assessment platform for college placement drives",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background`}
      >
        <Providers
          session={session?.session ?? null}
          user={(session?.user as any) ?? null}
        >
          {children}
          <Toaster position="top-right" offset={{ top: 64 }} />
        </Providers>
      </body>
    </html>
  );
}
