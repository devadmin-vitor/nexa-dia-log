import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";

import { Sidebar } from "@/components/Sidebar";
import { StatusBar } from "@/components/StatusBar";

import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Claude Commerce AI",
  description: "Gestão automatizada para operação de afiliados TikTok Shop Brasil",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <Suspense fallback={<div className="h-8 border-b border-border" />}>
              <StatusBar />
            </Suspense>
            <main className="mx-auto min-w-0 max-w-7xl px-4 py-6 sm:px-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
