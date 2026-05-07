"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Check, ChevronLeft, Sparkles, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogPortal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GradientMesh } from "@/components/effects/gradient-mesh";
import { trpc } from "@/lib/trpc/client";
import {
  WIDGET_REGISTRY,
  ALL_WIDGET_IDS,
  DEFAULT_WIDGET_IDS,
  type WidgetId,
} from "@/lib/dashboard/widgets-registry";
import type { WidgetCategory } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

type Step = "welcome" | "pick" | "done";

const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  revenue: "Revenue",
  expenses: "Expenses",
  profitability: "Profitability",
  cash: "Cash",
  gst: "GST & Tax",
  ops: "Operations",
  alerts: "Alerts",
};

interface OnboardingModalProps {
  open: boolean;
  onComplete: () => void;
}

export function OnboardingModal({ open, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [selected, setSelected] = useState<Set<WidgetId>>(new Set(DEFAULT_WIDGET_IDS));

  const utils = trpc.useUtils();
  const completeMutation = trpc.dashboards.completeOnboarding.useMutation({
    onSuccess: async () => {
      await utils.dashboards.getMyLayout.invalidate();
      setStep("done");
      setTimeout(() => {
        onComplete();
      }, 1400);
    },
  });

  const toggle = (id: WidgetId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const finish = (useDefaults: boolean) => {
    const ids = useDefaults ? DEFAULT_WIDGET_IDS : Array.from(selected);
    completeMutation.mutate({ widgetIds: ids });
  };

  const grouped = ALL_WIDGET_IDS.reduce<Map<WidgetCategory, WidgetId[]>>((acc, id) => {
    const def = WIDGET_REGISTRY[id];
    const list = acc.get(def.category) ?? [];
    list.push(id);
    acc.set(def.category, list);
    return acc;
  }, new Map());

  return (
    <Dialog open={open}>
      <DialogPortal>
        <div className="fixed inset-0 z-50 bg-bg/95 backdrop-blur-md flex items-center justify-center">
          <DialogContent
            // Override the small dialog default — full-bleed onboarding
            className="!fixed !inset-0 !translate-x-0 !translate-y-0 !left-0 !top-0 !max-w-none !w-full !h-full !rounded-none !shadow-none !border-0 !bg-transparent overflow-hidden flex items-center justify-center p-4"
          >
            <GradientMesh className="absolute inset-0 opacity-30 pointer-events-none" />

            <div className="relative w-full max-w-3xl">
              <AnimatePresence mode="wait">
                {step === "welcome" && (
                  <motion.div
                    key="welcome"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="text-center space-y-6"
                  >
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.2, duration: 0.5 }}
                      className="inline-flex items-center justify-center"
                    >
                      <div className="relative">
                        <div className="absolute inset-0 bg-accent/20 blur-2xl rounded-full" />
                        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-fg">
                          <Zap className="h-8 w-8" strokeWidth={2.5} />
                        </div>
                      </div>
                    </motion.div>

                    <div className="space-y-3">
                      <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-balance text-4xl font-bold tracking-tight text-fg leading-tight"
                      >
                        Welcome to <span className="text-accent">FinAI</span>
                      </motion.h1>
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="text-fg-muted text-balance max-w-md mx-auto"
                      >
                        Your AI accountant lives on WhatsApp. Let's set up your dashboard so it
                        shows what matters to <span className="text-fg">you</span>.
                      </motion.p>
                    </div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.55 }}
                      className="flex items-center justify-center gap-3 pt-2"
                    >
                      <Button size="lg" onClick={() => setStep("pick")}>
                        Continue
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.7 }}
                      className="flex items-center justify-center gap-1 text-[11px] font-mono uppercase tracking-widest text-fg-subtle pt-4"
                    >
                      <span>Step 1</span>
                      <span className="text-fg-muted">·</span>
                      <span>of 2</span>
                    </motion.div>
                  </motion.div>
                )}

                {step === "pick" && (
                  <motion.div
                    key="pick"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.35 }}
                    className="space-y-5"
                  >
                    <div>
                      <button
                        type="button"
                        onClick={() => setStep("welcome")}
                        className="flex items-center gap-1 text-[11px] font-mono text-fg-muted hover:text-fg mb-3"
                      >
                        <ChevronLeft className="h-3 w-3" />
                        Back
                      </button>
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <h2 className="text-2xl font-semibold text-fg">Pick your widgets</h2>
                          <p className="text-fg-muted text-[13px] mt-1">
                            What do you want on your dashboard? You can rearrange and add more later.
                          </p>
                        </div>
                        <div className="text-[11px] font-mono uppercase tracking-widest text-fg-subtle">
                          {selected.size} selected
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border border-border bg-bg-elevated/60 max-h-[55vh] overflow-auto divide-y divide-border/40">
                      {Array.from(grouped.entries()).map(([category, ids]) => (
                        <div key={category} className="px-4 py-3">
                          <p className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle mb-2">
                            {CATEGORY_LABELS[category]}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {ids.map((id) => {
                              const def = WIDGET_REGISTRY[id];
                              const Icon = def.icon;
                              const isSelected = selected.has(id);
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => toggle(id)}
                                  className={cn(
                                    "flex items-start gap-3 rounded-md p-2.5 text-left transition-all border",
                                    isSelected
                                      ? "border-accent/40 bg-accent/5"
                                      : "border-border/60 bg-bg-subtle/30 hover:border-border-strong",
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors",
                                      isSelected
                                        ? "bg-accent text-accent-fg"
                                        : "bg-bg-subtle border border-border text-fg-muted",
                                    )}
                                  >
                                    {isSelected ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-medium text-fg">{def.label}</p>
                                    <p className="text-[11px] text-fg-muted leading-snug mt-0.5">
                                      {def.description}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => finish(true)}
                        disabled={completeMutation.isPending}
                        className="text-[12px] text-fg-muted hover:text-fg flex items-center gap-1.5"
                      >
                        <Sparkles className="h-3 w-3" />
                        Use smart defaults
                      </button>
                      <Button
                        size="lg"
                        onClick={() => finish(false)}
                        disabled={selected.size === 0 || completeMutation.isPending}
                      >
                        {completeMutation.isPending ? "Setting up..." : `Build my dashboard (${selected.size})`}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {step === "done" && (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="text-center space-y-5"
                  >
                    <motion.div
                      initial={{ scale: 0.6 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 220, damping: 14 }}
                      className="relative inline-flex"
                    >
                      <div className="absolute inset-0 bg-positive/40 blur-2xl rounded-full" />
                      <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-positive text-bg">
                        <Check className="h-8 w-8" strokeWidth={3} />
                      </div>
                    </motion.div>
                    <div className="space-y-2">
                      <h2 className="text-3xl font-bold text-fg">You're all set</h2>
                      <p className="text-fg-muted">Loading your personalized dashboard...</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </DialogContent>
        </div>
      </DialogPortal>
    </Dialog>
  );
}
