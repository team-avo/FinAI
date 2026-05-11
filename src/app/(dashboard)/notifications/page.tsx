"use client";

import { AlertTriangle, Bell, CheckCircle2, Info } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShimmerSkeleton } from "@/components/effects/shimmer-skeleton";
import { cn } from "@/lib/utils";

const LEVEL_ICON: Record<string, React.ReactNode> = {
  critical: <AlertTriangle className="h-4 w-4 text-negative" />,
  warn: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  info: <Info className="h-4 w-4 text-fg-muted" />,
};

const LEVEL_BADGE: Record<string, "negative" | "warning" | "default"> = {
  critical: "negative",
  warn: "warning",
  info: "default",
};

function timeAgo(date: Date | string) {
  const ms = Date.now() - new Date(date).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function NotificationsPage() {
  const utils = trpc.useUtils();
  const { data: notifications, isLoading } = trpc.notifications.list.useQuery({ limit: 100 });
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => { utils.notifications.list.invalidate(); utils.notifications.unreadCount.invalidate(); },
  });
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => { utils.notifications.list.invalidate(); utils.notifications.unreadCount.invalidate(); },
  });

  const unread = notifications?.filter((n) => !n.readAt).length ?? 0;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-fg">Notifications</h1>
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()}>
            Mark all as read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <ShimmerSkeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : !notifications?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-fg-muted">
            <Bell className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No notifications yet</p>
            <p className="text-[12px] mt-1 opacity-60">Anomaly alerts, briefings, and approvals will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border border-border px-4 py-3 transition-colors",
                !n.readAt ? "bg-accent/5 border-accent/20" : "bg-card",
              )}
            >
              <span className="mt-0.5">{LEVEL_ICON[n.level] ?? LEVEL_ICON.info}</span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={cn("text-[13px] font-medium", !n.readAt ? "text-fg" : "text-fg-muted")}>
                    {n.title}
                  </p>
                  <Badge variant={LEVEL_BADGE[n.level] ?? "default"} className="text-[10px]">
                    {n.level}
                  </Badge>
                  <Badge variant="default" className="text-[10px] opacity-60">
                    {n.type.replace("_", " ")}
                  </Badge>
                </div>
                {n.body && (
                  <p className="text-[12px] text-fg-muted mt-0.5 line-clamp-2">{n.body}</p>
                )}
                <p className="text-[11px] text-fg-muted mt-1">{timeAgo(n.createdAt)}</p>
              </div>

              {!n.readAt && (
                <button
                  onClick={() => markRead.mutate({ id: n.id })}
                  className="text-[11px] text-accent hover:underline shrink-0"
                >
                  Mark read
                </button>
              )}
              {n.readAt && (
                <CheckCircle2 className="h-3.5 w-3.5 text-fg-muted/40 shrink-0 mt-0.5" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
