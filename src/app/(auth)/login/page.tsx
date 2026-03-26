"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import { Eye, EyeOff, Loader2, Lock, Mail, Zap } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn.email({ email, password });

      if (result.error) {
        toast.error(result.error.message || "Invalid credentials");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/auth/get-session");
      const session = await res.json();
      const role = session?.user?.role;

      switch (role) {
        case "SUPER_ADMIN":
          router.push("/admin");
          break;
        case "COLLEGE_ADMIN":
          router.push("/college");
          break;
        case "STUDENT":
          router.push("/student");
          break;
        default:
          router.push("/");
      }
    } catch {
      toast.error("An error occurred during login");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-2xl p-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-500/20 border border-indigo-500/30">
            <Zap className="size-5 text-indigo-400" aria-hidden="true" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Welcome back</h1>
        <p className="text-sm text-neutral-400">Sign in to your PrepZero account</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-medium text-neutral-300 uppercase tracking-wide">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-10 rounded-lg bg-white/[0.06] border border-white/[0.1] pl-9 pr-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-medium text-neutral-300 uppercase tracking-wide">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full h-10 rounded-lg bg-white/[0.06] border border-white/[0.1] pl-9 pr-10 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2 mt-2"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      {/* Register links */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/[0.08]" />
          <span className="text-xs text-neutral-500">New here?</span>
          <div className="flex-1 h-px bg-white/[0.08]" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/register"
            className="flex flex-col items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-center hover:bg-white/[0.07] hover:border-white/[0.15] transition-all"
          >
            <span className="text-xs font-medium text-neutral-200">College Admin</span>
            <span className="text-[11px] text-neutral-500 mt-0.5">Register here</span>
          </Link>
          <Link
            href="/register/student"
            className="flex flex-col items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-center hover:bg-white/[0.07] hover:border-white/[0.15] transition-all"
          >
            <span className="text-xs font-medium text-neutral-200">Student</span>
            <span className="text-[11px] text-neutral-500 mt-0.5">Register here</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
