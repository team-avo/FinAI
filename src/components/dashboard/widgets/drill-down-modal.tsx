"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight, ArrowLeft, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface DrillLevel {
  /** Title shown in the breadcrumb at this level. */
  title: string;
  /** Optional eyebrow shown above the title (small label). */
  eyebrow?: string;
  /** Optional subtitle for context. */
  subtitle?: string;
  /** The content of this level. */
  content: ReactNode;
}

interface DrillDownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Stack of levels — push to drill in, pop to go back. */
  levels: DrillLevel[];
  onPop: () => void;
}

/**
 * 3-level drill-down modal.
 *
 * Usage: parent maintains `levels` state. Push a new level when user clicks
 * something within the current content; pop on back.
 */
export function DrillDownModal({ open, onOpenChange, levels, onPop }: DrillDownModalProps) {
  const current = levels[levels.length - 1];
  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className="!max-w-4xl !w-[95vw] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {/* Header w/ breadcrumb */}
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border/60 bg-bg-elevated">
            <div className="min-w-0 flex-1">
              {/* Breadcrumb trail */}
              {levels.length > 1 && (
                <button
                  type="button"
                  onClick={onPop}
                  className="flex items-center gap-1 text-[11px] font-mono text-fg-muted hover:text-fg mb-1 -ml-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back
                </button>
              )}
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-fg-subtle mb-0.5">
                {levels.map((l, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && <ChevronRight className="h-2.5 w-2.5" />}
                    <span className={cn(i === levels.length - 1 && "text-accent")}>
                      {l.eyebrow ?? l.title}
                    </span>
                  </span>
                ))}
              </div>
              <h2 className="text-base font-semibold text-fg truncate">{current.title}</h2>
              {current.subtitle && (
                <p className="text-[12px] text-fg-muted mt-0.5">{current.subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-fg-subtle hover:text-fg hover:bg-bg-subtle"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content with slide animation */}
          <div className="flex-1 min-h-0 overflow-auto relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={levels.length}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="p-5"
              >
                {current.content}
              </motion.div>
            </AnimatePresence>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

/**
 * Small helper hook to manage the drill-down level stack.
 */
export function useDrillStack(initial: DrillLevel) {
  const [levels, setLevels] = useState<DrillLevel[]>([initial]);
  const [open, setOpen] = useState(false);

  const openAt = (root: DrillLevel) => {
    setLevels([root]);
    setOpen(true);
  };
  const push = (next: DrillLevel) => setLevels((prev) => [...prev, next]);
  const pop = () => setLevels((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));

  return { open, setOpen, levels, openAt, push, pop };
}
