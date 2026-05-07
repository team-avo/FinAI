"use client";

import Link from "next/link";
import { motion } from "motion/react";
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
      {/* Centered eyebrow */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex justify-center mb-8"
      >
        <Badge variant="accent" className="gap-1.5">
          <Sparkles className="h-3 w-3" />
          AI-native accounting · Built for India
        </Badge>
      </motion.div>

      {/* Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="text-balance text-center font-bold tracking-tight text-fg leading-[1.05]"
      >
        <span className="block text-5xl md:text-7xl">Accounting that</span>
        <span className="block text-5xl md:text-7xl mt-2">
          runs <span className="relative inline-block">
            <span className="relative z-10 text-accent">on its own.</span>
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="absolute bottom-1 left-0 right-0 h-3 bg-accent/15 origin-left -z-0"
            />
          </span>
        </span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.25 }}
        className="text-balance text-center text-fg-muted text-base md:text-lg max-w-2xl mx-auto mt-6 leading-relaxed"
      >
        FinAI is an AI agent that operates your books on WhatsApp. Bills, invoices, payments,
        GST, reports — all driven by chat. Zoho stays as your books of record. The bookkeeper goes away.
      </motion.p>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.4 }}
        className="flex items-center justify-center gap-3 flex-wrap mt-10"
      >
        <Button size="lg" asChild>
          <Link href="/login">
            Start free trial
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="secondary" size="lg" asChild>
          <Link href="#product">See it work →</Link>
        </Button>
      </motion.div>

      {/* Trust strip — small, monospace, fintech-serious */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.6 }}
        className="mt-14 flex justify-center items-center gap-6 flex-wrap text-[11px] font-mono uppercase tracking-widest text-fg-subtle"
      >
        <span>GST-correct</span>
        <span className="h-1 w-1 rounded-full bg-fg-subtle/40" />
        <span>India-edition</span>
        <span className="h-1 w-1 rounded-full bg-fg-subtle/40" />
        <span>Zoho integrated</span>
        <span className="h-1 w-1 rounded-full bg-fg-subtle/40" />
        <span>Claude AI</span>
      </motion.div>

      {/* Stats strip */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.7 }}
        className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto"
      >
        {STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 + i * 0.1 }}
            className={cn(
              "rounded-md border border-border bg-bg-elevated/50 px-4 py-3.5 backdrop-blur",
              "hover:border-accent/30 hover:bg-bg-elevated transition-colors",
            )}
          >
            <div className="font-mono text-2xl md:text-3xl font-bold text-accent tabular-nums">
              <NumberTicker value={stat.value} />
              {stat.suffix}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-subtle font-mono">
              {stat.label}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
