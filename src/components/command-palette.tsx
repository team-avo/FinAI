"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "cmdk";
import {
  BarChart3,
  FileText,
  Home,
  Receipt,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const NAVIGATION = [
  { label: "Dashboard", icon: Home, href: "/dashboard" },
  { label: "Contacts", icon: Users, href: "/dashboard/contacts" },
  { label: "Invoices", icon: FileText, href: "/dashboard/invoices" },
  { label: "Expenses", icon: Receipt, href: "/dashboard/expenses" },
  { label: "Reports", icon: BarChart3, href: "/dashboard/reports" },
  { label: "Settings", icon: Settings, href: "/dashboard/settings" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [toggle]);

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      setOpen(false);
      setQuery("");
    },
    [router],
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="fixed inset-x-0 top-[15%] z-50 mx-auto max-w-xl px-4">
        <Command
          className="overflow-hidden rounded-lg border border-border-strong bg-bg-elevated shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
          shouldFilter={true}
          loop
        >
          <div className="flex items-center border-b border-border px-3 gap-2">
            <Search className="h-4 w-4 shrink-0 text-fg-subtle" />
            <CommandInput
              placeholder="Search or type a command…"
              value={query}
              onValueChange={setQuery}
              className="flex h-11 w-full bg-transparent text-[13px] text-fg placeholder:text-fg-subtle outline-none"
            />
            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-0.5 rounded border border-border px-1.5 text-[10px] font-mono text-fg-subtle sm:flex">
              esc
            </kbd>
          </div>

          <CommandList className="max-h-80 overflow-y-auto p-1">
            <CommandEmpty className="px-4 py-8 text-center text-[13px] text-fg-muted">
              No results found.
            </CommandEmpty>

            <CommandGroup
              heading={
                <span className="px-2 pb-1 pt-2 block text-[10px] uppercase tracking-widest text-fg-subtle font-mono">
                  Navigation
                </span>
              }
            >
              {NAVIGATION.map((item) => (
                <CommandItem
                  key={item.href}
                  value={item.label}
                  onSelect={() => navigate(item.href)}
                  className="flex items-center gap-2.5 rounded px-2 py-2 text-[13px] text-fg-muted cursor-pointer select-none
                    data-[selected=true]:bg-bg-subtle data-[selected=true]:text-fg
                    hover:bg-bg-subtle hover:text-fg transition-colors"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator className="mx-2 my-1 h-px bg-border" />

            <CommandGroup
              heading={
                <span className="px-2 pb-1 pt-2 block text-[10px] uppercase tracking-widest text-fg-subtle font-mono">
                  Actions
                </span>
              }
            >
              <CommandItem
                value="New Invoice"
                onSelect={() => navigate("/dashboard/invoices/new")}
                className="flex items-center gap-2.5 rounded px-2 py-2 text-[13px] text-fg-muted cursor-pointer select-none
                  data-[selected=true]:bg-bg-subtle data-[selected=true]:text-fg
                  hover:bg-bg-subtle hover:text-fg transition-colors"
              >
                <FileText className="h-4 w-4 shrink-0" />
                New Invoice
              </CommandItem>
              <CommandItem
                value="New Expense"
                onSelect={() => navigate("/dashboard/expenses/new")}
                className="flex items-center gap-2.5 rounded px-2 py-2 text-[13px] text-fg-muted cursor-pointer select-none
                  data-[selected=true]:bg-bg-subtle data-[selected=true]:text-fg
                  hover:bg-bg-subtle hover:text-fg transition-colors"
              >
                <Receipt className="h-4 w-4 shrink-0" />
                New Expense
              </CommandItem>
            </CommandGroup>
          </CommandList>

          <div className="border-t border-border px-3 py-2 flex items-center justify-between">
            <span className="text-[11px] text-fg-subtle font-mono">
              FinAI command center
            </span>
            <span className="text-[11px] text-fg-subtle flex items-center gap-2">
              <kbd className="rounded border border-border px-1 text-[10px] font-mono">↑↓</kbd>
              navigate
              <kbd className="rounded border border-border px-1 text-[10px] font-mono">↵</kbd>
              select
            </span>
          </div>
        </Command>
      </div>
    </>
  );
}
