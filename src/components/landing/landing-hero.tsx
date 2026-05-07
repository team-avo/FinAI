import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NumberTicker } from "@/components/effects/number-ticker";
import { cn } from "@/lib/utils";

const STATS = [
  { label: "Faster than Zoho", value: 10, suffix: "×" },
  { label: "Setup time", value: 60, suffix: "s" },
  { label: "Accuracy", value: 99, suffix: "%" },
  { label: "Manual data entry", value: 0, suffix: "" },
];

export function LandingHero() {
  return (
    <section className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-20 md:pt-28 md:pb-24">
      <div className="flex justify-center mb-8 fin-fade-in">
        <Badge variant="accent" className="gap-1.5">
          <Sparkles className="h-3 w-3" />
          AI-native accounting · Built for India
        </Badge>
      </div>

      <h1 className="text-balance text-center font-bold tracking-tight text-fg leading-[1.05] fin-fade-in-up fin-d-100">
        <span className="block text-5xl md:text-7xl">Accounting that</span>
        <span className="block text-5xl md:text-7xl mt-2">
          runs{" "}
          <span className="relative inline-block">
            <span className="relative z-10 text-accent">on its own.</span>
            <span className="absolute bottom-1 left-0 right-0 h-3 bg-accent/15 -z-0" />
          </span>
        </span>
      </h1>

      <p className="text-balance text-center text-fg-muted text-base md:text-lg max-w-2xl mx-auto mt-6 leading-relaxed fin-fade-in-up fin-d-300">
        FinAI is an AI agent that operates your books on WhatsApp. Bills, invoices, payments,
        GST, reports — all driven by chat. Zoho stays as your books of record. The bookkeeper goes away.
      </p>

      <div className="flex items-center justify-center gap-3 flex-wrap mt-10 fin-fade-in-up fin-d-400">
        <Button size="lg" asChild>
          <Link href="/login">
            Start free trial
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="secondary" size="lg" asChild>
          <Link href="#product">See it work →</Link>
        </Button>
      </div>

      <div className="mt-14 flex justify-center items-center gap-6 flex-wrap text-[11px] font-mono uppercase tracking-widest text-fg-subtle fin-fade-in fin-d-600">
        <span>GST-correct</span>
        <span className="h-1 w-1 rounded-full bg-fg-subtle/40" />
        <span>India-edition</span>
        <span className="h-1 w-1 rounded-full bg-fg-subtle/40" />
        <span>Zoho integrated</span>
        <span className="h-1 w-1 rounded-full bg-fg-subtle/40" />
        <span>Claude AI</span>
      </div>

      <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto fin-fade-in-up fin-d-700">
        {STATS.map((stat, i) => (
          <div
            key={stat.label}
            className={cn(
              "rounded-md border border-border bg-bg-elevated/50 px-4 py-3.5 backdrop-blur",
              "hover:border-accent/30 hover:bg-bg-elevated transition-colors fin-fade-in-up",
              i === 0 ? "fin-d-800" : i === 1 ? "fin-d-900" : i === 2 ? "fin-d-1000" : "fin-d-1000",
            )}
          >
            <div className="font-mono text-2xl md:text-3xl font-bold text-accent tabular-nums">
              <NumberTicker value={stat.value} />
              {stat.suffix}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-subtle font-mono">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
