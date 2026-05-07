"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles } from "lucide-react";
import { GlowBorder } from "@/components/effects/glow-border";

interface Message {
  role: "user" | "ai";
  text: string;
  artifacts?: { label: string; value: string; tone?: "ok" | "info" }[];
}

const SCRIPT: Message[] = [
  {
    role: "user",
    text: "Raise invoice for Bluestone Tech ₹85,000 for consulting, due in 30 days",
  },
  {
    role: "ai",
    text: "Drafting now…",
    artifacts: [
      { label: "Number", value: "INV-1042" },
      { label: "GST", value: "₹15,300 IGST", tone: "info" },
      { label: "Total", value: "₹1,00,300", tone: "ok" },
      { label: "Status", value: "Sent · Emailed", tone: "ok" },
    ],
  },
  {
    role: "user",
    text: "What's my outstanding this month?",
  },
  {
    role: "ai",
    text: "₹2,15,000 across 3 invoices.",
    artifacts: [
      { label: "Overdue", value: "Redline Media — ₹45,000 (12d late)", tone: "info" },
    ],
  },
  {
    role: "user",
    text: "Send a reminder",
  },
  {
    role: "ai",
    text: "Reminder sent via Zoho. Notification queued for tomorrow if unpaid.",
    artifacts: [{ label: "Reminder rule", value: "After 14 days · learned from your 30-day NET", tone: "ok" }],
  },
];

export function TerminalDemo() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    if (visible >= SCRIPT.length) return;
    const t = setTimeout(() => setVisible((v) => v + 1), visible === 0 ? 600 : 1500);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-2 mb-6">
        <span className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
          A real conversation
        </span>
        <span className="h-1 w-1 rounded-full bg-fg-subtle/40" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
          From WhatsApp to your books
        </span>
      </div>

      <GlowBorder rounded="var(--radius-lg)" className="rounded-lg max-w-2xl mx-auto">
        <div className="rounded-lg border border-transparent bg-bg-elevated/95 overflow-hidden backdrop-blur-md">
          {/* Header */}
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-bg/40">
            <div className="h-2.5 w-2.5 rounded-full bg-negative/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-positive/70" />
            <span className="ml-2 text-[11px] font-mono text-fg-subtle">WhatsApp · FinAI Agent</span>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-positive animate-pulse" />
              <span className="text-[10px] font-mono text-fg-subtle">Online</span>
            </div>
          </div>

          {/* Messages */}
          <div className="px-5 py-5 space-y-4 font-mono text-[13px] min-h-[380px]">
            <AnimatePresence>
              {SCRIPT.slice(0, visible).map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="flex gap-3"
                >
                  <span
                    className={
                      msg.role === "user"
                        ? "text-fg-subtle shrink-0 w-8"
                        : "text-accent shrink-0 w-8"
                    }
                  >
                    {msg.role === "user" ? "You" : (
                      <span className="inline-flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        AI
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className={msg.role === "user" ? "text-fg" : "text-fg-muted"}>
                      {msg.text}
                    </p>
                    {msg.artifacts && (
                      <div className="space-y-1">
                        {msg.artifacts.map((a, j) => (
                          <motion.div
                            key={j}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.25, delay: 0.1 + j * 0.08 }}
                            className="flex items-center gap-2 text-[12px]"
                          >
                            <span className="text-fg-subtle">{a.label}:</span>
                            <span
                              className={
                                a.tone === "ok"
                                  ? "text-positive"
                                  : a.tone === "info"
                                    ? "text-info"
                                    : "text-fg"
                              }
                            >
                              {a.value}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {visible < SCRIPT.length && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <span className="text-fg-subtle shrink-0 w-8" />
                <div className="flex items-center gap-1.5 text-fg-subtle">
                  <motion.div
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
                    className="h-1.5 w-1.5 rounded-full bg-fg-subtle"
                  />
                  <motion.div
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: 0.15 }}
                    className="h-1.5 w-1.5 rounded-full bg-fg-subtle"
                  />
                  <motion.div
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: 0.3 }}
                    className="h-1.5 w-1.5 rounded-full bg-fg-subtle"
                  />
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </GlowBorder>
    </div>
  );
}
