"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  WIDGET_REGISTRY,
  ALL_WIDGET_IDS,
  type WidgetId,
} from "@/lib/dashboard/widgets-registry";
import type { WidgetCategory } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

interface WidgetCatalogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (id: WidgetId) => void;
  existingTypes: WidgetId[];
}

const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  revenue: "Revenue",
  expenses: "Expenses",
  profitability: "Profitability",
  cash: "Cash",
  gst: "GST & Tax",
  ops: "Operations",
  alerts: "Alerts",
};

export function WidgetCatalog({ open, onOpenChange, onAdd, existingTypes }: WidgetCatalogProps) {
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const filter = query.trim().toLowerCase();
    const map = new Map<WidgetCategory, WidgetId[]>();
    for (const id of ALL_WIDGET_IDS) {
      const def = WIDGET_REGISTRY[id];
      if (filter && !def.label.toLowerCase().includes(filter) && !def.description.toLowerCase().includes(filter)) {
        continue;
      }
      const list = map.get(def.category) ?? [];
      list.push(id);
      map.set(def.category, list);
    }
    return Array.from(map.entries());
  }, [query]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader>
          <SheetTitle>Add a widget</SheetTitle>
          <SheetDescription>
            Click any widget to add it to your dashboard.
          </SheetDescription>
        </SheetHeader>

        <div className="px-5 pt-4 pb-3 border-b border-border/60">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-fg-muted pointer-events-none" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search widgets..."
              className="pl-8 h-8"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {grouped.length === 0 ? (
            <p className="text-center text-fg-muted text-[13px] py-8">No widgets match.</p>
          ) : (
            grouped.map(([category, ids]) => (
              <div key={category} className="px-5 py-3 border-b border-border/40 last:border-0">
                <p className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle mb-2">
                  {CATEGORY_LABELS[category]}
                </p>
                <div className="space-y-1">
                  {ids.map((id) => {
                    const def = WIDGET_REGISTRY[id];
                    const Icon = def.icon;
                    const alreadyAdded = existingTypes.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onAdd(id)}
                        className={cn(
                          "w-full flex items-start gap-3 rounded-md p-2.5 text-left transition-colors",
                          "hover:bg-bg-subtle hover:border-border border border-transparent",
                        )}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-bg-subtle border border-border text-fg-muted">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-medium text-fg">{def.label}</p>
                            {alreadyAdded && (
                              <span className="text-[10px] font-mono uppercase tracking-wider text-fg-subtle">
                                · added
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-fg-muted leading-snug mt-0.5">
                            {def.description}
                          </p>
                        </div>
                        <div className="shrink-0 self-center text-fg-subtle">
                          <Plus className="h-3.5 w-3.5" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
