"use client";

import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, Copy } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShimmerSkeleton } from "@/components/effects/shimmer-skeleton";
import { toast } from "sonner";
import type { MoneyItem, MoneyTone } from "@/lib/ai/money-check";

const TONE: Record<MoneyTone, string> = {
  critical: "text-red-500",
  warn: "text-amber-500",
  positive: "text-emerald-500",
  info: "text-accent",
  muted: "text-fg-muted",
};

function ItemRow({ item }: { item: MoneyItem }) {
  const router = useRouter();

  async function onAction() {
    const a = item.action;
    if (!a || a.soon) return;
    if (a.copy) {
      try {
        await navigator.clipboard.writeText(a.copy);
        toast.success("Reminders copied — paste into WhatsApp or email");
      } catch {
        toast.error("Couldn't copy. Select the text manually.");
      }
      return;
    }
    if (a.href) router.push(a.href);
  }

  return (
    <Card className={item.live ? "" : "opacity-60"}>
      <CardContent className="py-4">
        <div className="flex gap-3">
          <div className="text-xl leading-none mt-0.5 shrink-0" aria-hidden>{item.icon}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`text-sm font-semibold ${TONE[item.tone]}`}>{item.title}</span>
              {!item.live && <Badge variant="ghost">Soon</Badge>}
            </div>
            <p className="text-[13px] text-fg-muted mt-0.5 leading-relaxed">{item.detail}</p>

            {item.list && item.list.length > 0 && (
              <div className="mt-2.5 space-y-1">
                {item.list.map((l, i) => (
                  <div key={i} className="flex items-center justify-between text-[12px]">
                    <span className="text-fg truncate pr-3">{l.label}</span>
                    <span className="text-fg-muted tabular-nums shrink-0">{l.value}</span>
                  </div>
                ))}
              </div>
            )}

            {item.action && (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant={item.action.soon ? "ghost" : "secondary"}
                  disabled={item.action.soon}
                  onClick={onAction}
                >
                  {item.action.copy ? <Copy className="size-3.5" /> : null}
                  {item.action.label}
                  {item.action.href ? <ArrowRight className="size-3.5" /> : null}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MoneyCheckPage() {
  const q = trpc.moneyCheck.get.useQuery();
  const data = q.data;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Agent header */}
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-xl bg-accent grid place-items-center text-accent-fg font-bold shrink-0 shadow-glow">
          Fi
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-fg">FinAI</h1>
            <span className="text-[11px] font-mono text-emerald-500 flex items-center gap-1">
              <Sparkles className="size-3" /> your money brain
            </span>
          </div>
          <p className="text-[13px] text-fg-muted">
            {data ? (
              <>
                ☀️ {data.dateLabel} money check — {data.headline}
              </>
            ) : (
              "Assembling your money check…"
            )}
          </p>
        </div>
      </div>

      {q.isLoading ? (
        <>
          <ShimmerSkeleton className="h-20 w-full" />
          <ShimmerSkeleton className="h-20 w-full" />
          <ShimmerSkeleton className="h-20 w-full" />
        </>
      ) : (
        data?.items.map((item) => <ItemRow key={item.kind} item={item} />)
      )}

      <p className="text-[11px] text-fg-muted font-mono leading-relaxed pt-1">
        The agent proposes; you decide with a tap. Items marked “Soon” unlock as we connect the bank feed,
        payments, and a lending partner — FinAI never holds your money.
      </p>
    </div>
  );
}
