import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-background text-foreground font-sans flex flex-col">
      {/* Centered Navbar with logo only */}
      <header className="w-full bg-white/70 border-b border-border/60 py-4 backdrop-blur-md sticky top-0 z-40 shadow-sm flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#8CC0EB] text-[#1E293B] shadow-sm">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 font-sans">
            MeetGest
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-10">
        {children}
      </main>
    </div>
  );
}

