"use client";

import { motion } from "motion/react";
import {
  AlertTriangle,
  Bot,
  Camera,
  FileText,
  LayoutDashboard,
  Receipt,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { GlowBorder } from "@/components/effects/glow-border";

const FEATURES = [
  {
    icon: FileText,
    title: "Invoice on WhatsApp",
    body: 'Text "raise invoice for X ₹Y for Z." Done. GST, place of supply, e-IRN — all handled. Email goes out via Zoho.',
    accent: true,
  },
  {
    icon: Camera,
    title: "Bill photos that actually work",
    body: "Snap a receipt, send it. AI matches it to the bank-fed Zoho entry, attaches the photo, picks the category. ITC captured.",
  },
  {
    icon: TrendingUp,
    title: "Reports as conversations",
    body: '"Why is travel up?" gets a real answer with the line items, not a CSV. Compare months, drill into customers, all on chat.',
  },
  {
    icon: AlertTriangle,
    title: "Proactive, not passive",
    body: "Payment lands in the bank → WhatsApp ping. Invoice goes overdue past the customer's terms → reminder fires. You don't check, it tells you.",
  },
  {
    icon: LayoutDashboard,
    title: "Your dashboard, not Zoho's",
    body: "Pin the KPIs you actually care about. Drag, resize, drill three levels deep. Minimal by default, dense when you need it.",
  },
  {
    icon: Bot,
    title: "Powered by Claude",
    body: "Every action is reasoned through Claude Sonnet/Opus. Tool-validated. Tagged source=ai with one-click revert if it ever gets it wrong.",
  },
];

export function LandingFeatures() {
  return (
    <section className="relative z-10 max-w-6xl mx-auto px-6 py-24">
      <div className="text-center mb-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-1.5 mb-4"
        >
          <Sparkles className="h-3 w-3 text-accent" />
          <span className="text-[11px] font-mono uppercase tracking-widest text-accent">
            Six pillars
          </span>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-balance text-3xl md:text-4xl font-bold tracking-tight text-fg mb-3"
        >
          Everything accounting. Nothing manual.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-balance text-fg-muted max-w-xl mx-auto"
        >
          Built specifically to replace the bookkeeper visit. Not generic AI gloss on top of accounting — purpose-built for India SMB realities.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: i * 0.06 }}
          >
            <GlowBorder rounded="var(--radius-md)" className="rounded-md h-full">
              <div className="rounded-md border border-transparent bg-bg-elevated/80 backdrop-blur p-5 h-full">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-bg-subtle border border-border text-accent mb-4">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-fg mb-2 text-[15px] leading-tight">
                  {f.title}
                </h3>
                <p className="text-[13px] text-fg-muted leading-relaxed">{f.body}</p>
              </div>
            </GlowBorder>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
