import "./globals.css";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "Hospital Queue — Step by Step",
  description: "Build a local queue app slowly and clearly",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="bg-slate-50 text-slate-900">
        {children}
        <Analytics />
      </body>
</html>
);
}