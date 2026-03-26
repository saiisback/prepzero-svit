import { Zap } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark min-h-svh flex flex-col bg-[#0c0d1a] text-neutral-100 relative overflow-hidden">
      {/* Ambient glows matching landing page */}
      <div className="pointer-events-none absolute -top-40 -left-40 size-[520px] rounded-full bg-indigo-600/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 size-80 rounded-full bg-violet-600/10 blur-3xl" />

      {/* Minimal top bar */}
      <header className="relative z-10 flex h-14 items-center px-6 border-b border-white/[0.06]">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/20 border border-indigo-500/30">
            <Zap className="size-3.5 text-indigo-400" aria-hidden="true" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white">PrepZero</span>
        </Link>
      </header>

      {/* Centered form */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
