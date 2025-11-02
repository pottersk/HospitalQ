import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hospital Queue — Step by Step",
  description: "Build a local queue app slowly and clearly",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="bg-slate-50 text-slate-900">
<header className="sticky top-0 z-10 backdrop-blur bg-white/90 border-b border-pink-100">
  <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
    <div className="flex-1 flex justify-center">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-pink-500 to-pink-600 text-white flex items-center justify-center font-extrabold shadow-lg shadow-pink-200/50">
          Q
        </div>
        <div className="text-2xl font-bold text-pink-800 tracking-tight">
          ระบบคิวโรงพยาบาล
        </div>
      </div>
    </div>
    <a 
      href="/nurse" 
      className="ml-4 px-4 py-2 text-sm rounded-xl border-2 border-pink-200 
        bg-white hover:bg-pink-50 text-pink-600 font-medium
        transition-all duration-200 hover:scale-105 hover:shadow-md
        flex items-center gap-2 group"
    >
      <svg 
        className="w-4 h-4 transition-transform group-hover:scale-110" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" 
        />
      </svg>
      <span>พยาบาล</span>
    </a>
  </div>
</header>
<main className="max-w-4xl mx-auto">{children}</main>
</body>
</html>
);
}