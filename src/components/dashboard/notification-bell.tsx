"use client";

import { useRouter } from "next/navigation";
import { Bell, AlertTriangle, CheckCircle2, Clock, Info } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/db/schema";

const LEVEL_ICON: Record<string, React.ReactNode> = {
  critical: <AlertTriangle className="h-3.5 w-3.5 text-negative shrink-0" />,
  warn: <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />,
  info: <Info className="h-3.5 w-3.5 text-fg-muted shrink-0" />,
};

function timeAgo(date: Date | string) {
  const ms = Date.now() - new Date(date).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: count = 0 } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const { data: items = [] } = trpc.notifications.list.useQuery({ limit: 6 });
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });

  function handleClick(n: Notification) {
    if (!n.readAt) markRead.mutate({ id: n.id });
    if (n.entityRef) {
      const [type, ref] = n.entityRef.split(":");
      if (type === "invoice") router.push(`/invoices/${ref}`);
      else if (type === "expense") router.push(`/expenses`);
      else if (type === "approval") router.push(`/approvals`);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative flex h-7 w-7 items-center justify-center rounded text-fg-muted hover:text-fg hover:bg-border/40 transition-colors outline-none">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white leading-none">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-[13px] font-semibold text-fg">Notifications</span>
          {count > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-[11px] text-accent hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Items */}
        <div className="divide-y divide-border max-h-72 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-fg-muted">
              <CheckCircle2 className="h-6 w-6 mb-1.5 opacity-40" />
              <p className="text-[12px]">All caught up</p>
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  "w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-border/20 transition-colors",
                  !n.readAt && "bg-accent/5",
                )}
              >
                <span className="mt-0.5">{LEVEL_ICON[n.level] ?? LEVEL_ICON.info}</span>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-[12px] truncate", !n.readAt ? "text-fg font-medium" : "text-fg-muted")}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-[11px] text-fg-muted line-clamp-1 mt-0.5">{n.body}</p>
                  )}
                </div>
                <span className="text-[10px] text-fg-muted shrink-0 mt-0.5">
                  {timeAgo(n.createdAt)}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-3 py-2">
          <button
            onClick={() => router.push("/notifications")}
            className="text-[11px] text-accent hover:underline w-full text-center"
          >
            View all notifications
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
