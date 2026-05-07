"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlowBorder } from "@/components/effects/glow-border";

const PRO_FEATURES = [
  "Unlimited WhatsApp invoices, expenses, queries",
  "Bill photo OCR with auto-category learning",
  "Zoho Books integration (read + write)",
  "Customizable dashboard with 35+ widgets",
  "Per-customer reminder policies",
  "Bank feed → real-time alerts",
  "GST-correct invoicing (CGST/SGST/IGST + e-IRN)",
  "AI-tagged audit log with one-click revert",
  "WhatsApp morning digest",
  "Powered by Claude Opus + Sonnet",
];

export function PricingSection() {
  return (
    <section className="max-w-5xl mx-auto px-6 py-24">
      <div className="text-center mb-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-1.5 mb-4"
        >
          <span className="text-[11px] font-mono uppercase tracking-widest text-accent">Pricing</span>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-balance text-3xl md:text-4xl font-bold tracking-tight text-fg mb-3"
        >
          One plan. Built for serious teams.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-fg-muted max-w-md mx-auto"
        >
          Cheaper than a bookkeeper. Faster than Zoho. No per-seat upcharges.
        </motion.p>
      </div>

      <div className="max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <GlowBorder rounded="var(--radius-lg)" className="rounded-lg">
            <div className="rounded-lg border border-transparent bg-bg-elevated/80 backdrop-blur p-7 relative overflow-hidden">
              {/* Subtle gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.04] to-transparent pointer-events-none" />

              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xl font-semibold text-fg">Pro</h3>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-accent bg-accent/10 px-2 py-1 rounded">
                    Most teams
                  </span>
                </div>
                <p className="text-fg-muted text-[13px] mb-6">
                  Everything to replace the bookkeeper.
                </p>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-fg-muted text-lg font-mono">₹</span>
                  <span className="text-5xl font-bold tracking-tight text-fg font-mono tabular-nums">
                    4,999
                  </span>
                  <span className="text-fg-muted text-[13px] ml-1">/mo</span>
                </div>
                <p className="text-[11px] font-mono text-fg-subtle mb-6">
                  Billed monthly · Cancel anytime · 14-day free trial
                </p>

                <Button size="lg" className="w-full" asChild>
                  <Link href="/login">
                    Start free trial
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>

                <div className="mt-7 pt-6 border-t border-border/60">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle mb-3">
                    Everything included
                  </p>
                  <ul className="space-y-2">
                    {PRO_FEATURES.map((f, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: i * 0.04 }}
                        className="flex items-start gap-2 text-[13px] text-fg-muted"
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/15 mt-0.5">
                          <Check className="h-2.5 w-2.5 text-accent" strokeWidth={3} />
                        </span>
                        <span className="leading-snug">{f}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </GlowBorder>
        </motion.div>

        <p className="text-center text-[11px] text-fg-subtle mt-6 font-mono">
          Need enterprise? <Link href="/login" className="text-accent hover:underline">Get in touch</Link>
        </p>
      </div>
    </section>
  );
}
