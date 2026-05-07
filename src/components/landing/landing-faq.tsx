"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "Does FinAI replace Zoho Books?",
    a: "No — FinAI works on top of Zoho. Zoho stays as your books of record (so your CA, audit trail, and GST filing flows are unchanged). FinAI is the AI layer that drives Zoho on your behalf via WhatsApp and a custom dashboard.",
  },
  {
    q: "How does the WhatsApp integration work?",
    a: "Connect your Zoho Books account in the dashboard, then add the FinAI number to WhatsApp. From there, you can text invoices, send bill photos, ask P&L questions, and receive proactive notifications — all on the WhatsApp number your team already uses.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. We never store passwords or banking credentials. Zoho integration uses OAuth refresh tokens, scoped to your Zoho organization. All AI actions are tagged source=ai with one-click revert. Audit log per user, full action history.",
  },
  {
    q: "What about GST filing?",
    a: "Zoho already files GSTR-1 and GSTR-3B directly to GSTN — that flow continues to work. FinAI ensures every invoice and expense pushed into Zoho has correct CGST/SGST/IGST split, place of supply, and (if applicable) e-IRN.",
  },
  {
    q: "Can I customize my dashboard?",
    a: "Yes. The dashboard is fully configurable — drag, resize, add, and remove widgets from a catalog of 35+ KPIs, charts, and lists. Click any widget for a 3-level drill-down with full transaction detail.",
  },
  {
    q: "Do you support Tally?",
    a: "Not yet. Phase 1 supports Zoho Books only. Tally export (for CA workflows) is on the roadmap if there's demand.",
  },
];

export function LandingFAQ() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-24">
      <div className="text-center mb-12">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-balance text-3xl md:text-4xl font-bold tracking-tight text-fg mb-3"
        >
          Questions, answered.
        </motion.h2>
      </div>

      <div className="rounded-md border border-border bg-bg-elevated/60 backdrop-blur divide-y divide-border/40">
        {FAQS.map((faq, i) => (
          <FaqItem key={i} faq={faq} />
        ))}
      </div>
    </section>
  );
}

function FaqItem({ faq }: { faq: { q: string; a: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-bg-subtle/40 transition-colors"
      >
        <span className="text-[14px] font-medium text-fg">{faq.q}</span>
        <Plus
          className={cn(
            "h-4 w-4 shrink-0 text-fg-muted transition-transform",
            open && "rotate-45 text-accent",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-4 text-[13px] text-fg-muted leading-relaxed">{faq.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
