import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Code2,
  BarChart3,
  Users,
  ArrowRight,
  FileText,
  CheckCircle2,
} from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Proctored Test Environments",
    desc: "Tracks tab switches, fullscreen exits, and suspicious activity. Auto-submit on violation threshold.",
  },
  {
    icon: Code2,
    title: "Multi-Language Code Execution",
    desc: "Monaco editor with sandboxed Judge0 execution. Python, Java, C, and C++ with test case validation.",
  },
  {
    icon: BarChart3,
    title: "Automated Scoring & Analytics",
    desc: "Instant grading with detailed breakdowns. Negative marking, per-question analytics, and exports.",
  },
  {
    icon: Users,
    title: "Bulk Student Management",
    desc: "CSV import with USN-based department extraction. College codes for easy onboarding at scale.",
  },
];

export default function LandingPage() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0c0d1a] text-neutral-100 relative overflow-hidden">
      {/* ── Layer 1: Deep indigo base ── */}
      {/* Set via bg-[#0c0d1a] above — true deep indigo, not black */}

      {/* ── Layer 2: Radial light bloom — offset left & up ── */}
      <div
        className="pointer-events-none fixed inset-0 -z-20"
        style={{
          background: [
            // Primary bloom: offset left and up, warm indigo
            "radial-gradient(ellipse 70% 55% at 35% 35%, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0.04) 50%, transparent 80%)",
            // Secondary bloom: softer, slightly lower — adds depth falloff
            "radial-gradient(ellipse 50% 40% at 45% 50%, rgba(139, 92, 246, 0.06) 0%, transparent 70%)",
          ].join(", "),
        }}
      />

      {/* ── Layer 3: Noise texture ── */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      {/* Navbar */}
      <header className="border-b border-white/[0.06] sticky top-0 z-50 bg-[#0c0d1a]/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-14 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <FileText className="size-5 text-neutral-300" />
            <span className="text-[15px] font-semibold tracking-tight text-neutral-100">
              PrepZero
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.06]"
              asChild
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              size="sm"
              className="bg-white text-neutral-900 hover:bg-neutral-200 h-8 px-3.5 text-[13px] font-medium"
              asChild
            >
              <Link href="/register/student">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex-1 flex items-center justify-center py-28 md:py-40 px-4">
        {/* Localized bloom behind headline — reinforces Layer 2 */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 42% 40%, rgba(99, 102, 241, 0.07) 0%, transparent 65%)",
          }}
        />
        <div className="container mx-auto text-center max-w-3xl relative z-10">
          <p className="text-[13px] font-medium tracking-widest uppercase text-neutral-500 mb-6">
            Campus Placement Platform
          </p>

          <h1 className="text-4xl sm:text-5xl md:text-[68px] font-bold tracking-[-0.03em] leading-[1.08] mb-6">
            Campus Placement,
            <br />
            <span className="text-transparent bg-clip-text bg-[linear-gradient(to_right,#c8c8d0,#7877c6,#5b5bd6,#7877c6,#c8c8d0)] bg-[length:200%_auto]">
              Simplified.
            </span>
          </h1>

          <p className="text-base md:text-lg text-neutral-400 mb-10 max-w-xl mx-auto leading-relaxed">
            Streamline your placement process with AI-powered assessments,
            real-time proctoring, and detailed analytics.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="bg-white text-neutral-900 hover:bg-neutral-200 h-11 px-7 text-sm font-medium"
              asChild
            >
              <Link href="/register/student">
                Get Started
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/[0.1] text-neutral-300 hover:bg-white/[0.06] hover:text-neutral-100 h-11 px-7 text-sm font-medium bg-transparent"
              asChild
            >
              <Link href="/register">Register College</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Divider glow */}
      <div className="relative h-px w-full">
        <div className="absolute inset-0 bg-white/[0.06]" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 100% at 50% 0%, rgba(99, 102, 241, 0.12) 0%, transparent 100%)",
          }}
        />
      </div>

      {/* Features */}
      <section className="py-24 md:py-32 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <p className="text-[13px] font-medium tracking-widest uppercase text-neutral-500 mb-4">
              Features
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Everything you need for
              <br className="hidden md:block" />
              placement drives
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 transition-colors duration-200 hover:bg-white/[0.04] hover:border-white/[0.1]"
              >
                <feature.icon className="size-5 text-neutral-500 mb-4" />
                <h3 className="font-medium text-[15px] text-neutral-200 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-neutral-500 leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-px w-full bg-white/[0.06]" />

      {/* Steps */}
      <section className="py-24 md:py-32 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <p className="text-[13px] font-medium tracking-widest uppercase text-neutral-500 mb-4">
              How it works
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Three steps to get started
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {[
              {
                step: "1",
                title: "Set up your college",
                desc: "Register as admin, configure departments, generate student invite codes.",
              },
              {
                step: "2",
                title: "Create placement drives",
                desc: "Build tests with MCQs and coding challenges. Set time limits and proctoring.",
              },
              {
                step: "3",
                title: "Analyze results",
                desc: "Students take proctored tests. Get instant scoring and exportable analytics.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="text-[13px] font-medium text-neutral-600 mb-3">
                  {item.step.padStart(2, "0")}
                </div>
                <h3 className="font-medium text-[15px] text-neutral-200 mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-neutral-500 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 md:py-32 px-4">
        {/* Subtle glow behind CTA */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 60% at 50% 50%, rgba(99, 102, 241, 0.04) 0%, transparent 70%)",
          }}
        />

        <div className="container mx-auto text-center max-w-2xl relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Ready to get started?
          </h2>
          <p className="text-neutral-400 mb-8 leading-relaxed">
            Join colleges already using PrepZero for faster, fairer placement
            assessments.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="bg-white text-neutral-900 hover:bg-neutral-200 h-11 px-7 text-sm font-medium"
              asChild
            >
              <Link href="/register/student">
                Start as Student
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/[0.1] text-neutral-300 hover:bg-white/[0.06] hover:text-neutral-100 h-11 px-7 text-sm font-medium bg-transparent"
              asChild
            >
              <Link href="/register">Register College</Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-10 text-[13px] text-neutral-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-neutral-600" />
              No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-neutral-600" />
              Set up in minutes
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-neutral-600" />
              Free for students
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-6 px-4">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-[13px] text-neutral-500">
          <div className="flex items-center gap-2">
            <FileText className="size-3.5 text-neutral-600" />
            <span className="font-medium text-neutral-400">PrepZero</span>
          </div>
          <p>Campus placement testing platform</p>
        </div>
      </footer>
    </div>
  );
}
