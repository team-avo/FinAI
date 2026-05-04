import Link from "next/link";
import { ArrowRight, Bot, FileText, Receipt, TrendingUp, Zap } from "lucide-react";
import { GridBg } from "@/components/effects/grid-bg";
import { GradientMesh } from "@/components/effects/gradient-mesh";
import { GlowBorder } from "@/components/effects/glow-border";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  {
    icon: FileText,
    title: "Invoice in seconds",
    body: 'Text "raise invoice for ABC ₹25K" on WhatsApp. Invoice created, PDF generated, email sent.',
  },
  {
    icon: Receipt,
    title: "Expenses by photo",
    body: "Snap a bill, send it. AI reads vendor, amount, and date. Expense filed instantly.",
  },
  {
    icon: TrendingUp,
    title: "P&L on demand",
    body: '"What\'s my profit this month?" Answer in under 2 seconds, always accurate.',
  },
  {
    icon: Bot,
    title: "AI categorization",
    body: "Swiggy → Food. AWS → Infrastructure. Uber → Travel. Learns your patterns.",
  },
  {
    icon: Zap,
    title: "Double-entry correct",
    body: "Every rupee tracked twice. CA-validated accounting engine under the hood.",
  },
];

const STATS = [
  { label: "Faster than Zoho", value: "10×" },
  { label: "Accuracy target", value: "99%" },
  { label: "Avg response time", value: "<2s" },
  { label: "Manual clicks saved", value: "∞" },
];

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <GridBg />
      <GradientMesh />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold tracking-tight text-fg">
            Fin<span className="text-accent">AI</span>
          </span>
          <Badge variant="accent">Beta</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/login">
              Get access
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pt-24 pb-16 text-center">
        <Badge variant="accent" className="mb-6 inline-flex">
          <Zap className="h-3 w-3" />
          Powered by Claude Opus
        </Badge>

        <h1 className="text-balance text-5xl font-bold tracking-tight text-fg leading-[1.1] mb-6 md:text-6xl">
          Your accountant
          <br />
          <span className="text-accent">lives on WhatsApp</span>
        </h1>

        <p className="text-balance text-base text-fg-muted max-w-xl mx-auto mb-10 leading-relaxed">
          FinAI is an AI-first accounting platform. Stop clicking through Zoho — just text your
          books. Invoices, expenses, P&L reports, all through a chat interface.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Button size="lg" asChild>
            <Link href="/login">
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="secondary" size="lg" asChild>
            <Link href="/login">View demo →</Link>
          </Button>
        </div>

        {/* Stats strip */}
        <div className="mt-16 grid grid-cols-2 gap-3 md:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-md border border-border bg-bg-elevated/60 px-4 py-3 glass"
            >
              <div className="font-mono text-2xl font-bold text-accent tabular-nums">
                {stat.value}
              </div>
              <div className="mt-0.5 text-[11px] uppercase tracking-wider text-fg-subtle font-mono">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Terminal mockup */}
      <section className="relative z-10 mx-auto max-w-2xl px-6 pb-16">
        <GlowBorder rounded="var(--radius-lg)" className="rounded-lg">
          <div className="rounded-lg border border-transparent bg-bg-elevated overflow-hidden">
            {/* Terminal header */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-bg">
              <div className="h-2.5 w-2.5 rounded-full bg-negative/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-warning/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-positive/70" />
              <span className="ml-2 text-[11px] font-mono text-fg-subtle">WhatsApp · FinAI Agent</span>
            </div>
            {/* Chat messages */}
            <div className="px-5 py-5 space-y-4 font-mono text-[13px]">
              <div className="flex gap-3">
                <span className="text-fg-subtle shrink-0">You</span>
                <span className="text-fg">
                  Raise invoice for Bluestone Tech ₹85,000 for consulting services, due in 30
                  days
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-accent shrink-0">AI</span>
                <div className="text-fg-muted space-y-1">
                  <p>Got it. Creating invoice for Bluestone Tech...</p>
                  <p className="text-positive">
                    ✓ Invoice #INV-0042 created — ₹85,000 + ₹15,300 GST
                  </p>
                  <p className="text-positive">✓ PDF generated</p>
                  <p className="text-positive">✓ Emailed to accounts@bluestone.tech</p>
                  <p className="text-fg-subtle mt-2 text-[11px]">Due: Jun 3, 2026</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-fg-subtle shrink-0">You</span>
                <span className="text-fg">What's my outstanding this month?</span>
              </div>
              <div className="flex gap-3">
                <span className="text-accent shrink-0">AI</span>
                <div className="text-fg-muted">
                  <p>3 invoices unpaid — total ₹2,15,000</p>
                  <p className="text-negative">1 overdue by 12 days (Redline Media ₹45,000)</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                <span className="text-fg-subtle text-[11px]">Agent is ready</span>
              </div>
            </div>
          </div>
        </GlowBorder>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-24">
        <h2 className="text-center text-2xl font-bold text-fg mb-8 tracking-tight">
          Everything accounting. Nothing manual.
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {FEATURES.slice(0, 3).map((f) => (
            <GlowBorder key={f.title} rounded="var(--radius-md)" className="rounded-md">
              <div className="rounded-md border border-transparent bg-bg-elevated p-5 h-full">
                <f.icon className="h-5 w-5 text-accent mb-3" />
                <h3 className="font-medium text-sm text-fg mb-1.5">{f.title}</h3>
                <p className="text-[12px] text-fg-muted leading-relaxed">{f.body}</p>
              </div>
            </GlowBorder>
          ))}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {FEATURES.slice(3).map((f) => (
            <GlowBorder key={f.title} rounded="var(--radius-md)" className="rounded-md">
              <div className="rounded-md border border-transparent bg-bg-elevated p-5 h-full">
                <f.icon className="h-5 w-5 text-accent mb-3" />
                <h3 className="font-medium text-sm text-fg mb-1.5">{f.title}</h3>
                <p className="text-[12px] text-fg-muted leading-relaxed">{f.body}</p>
              </div>
            </GlowBorder>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border px-6 py-5 flex items-center justify-between">
        <span className="font-mono text-xs text-fg-subtle">
          © 2026 AdvertOut · FinAI
        </span>
        <span className="text-[11px] text-fg-subtle">
          Built with Claude ·{" "}
          <kbd className="rounded border border-border px-1 font-mono">⌘K</kbd> to navigate
        </span>
      </footer>
    </main>
  );
}
