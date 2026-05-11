"use client";

import { usePathname } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/command-palette";
import { UserMenu } from "@/components/dashboard/user-menu";
import { NotificationBell } from "@/components/dashboard/notification-bell";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/invoices": "Invoices",
  "/expenses": "Expenses",
  "/contacts": "Contacts",
  "/items": "Items",
  "/reports": "Reports",
  "/chat": "AI Chat",
  "/settings": "Settings",
  "/activity": "AI Activity",
  "/notifications": "Notifications",
  "/approvals": "Approvals",
};

function getBreadcrumb(pathname: string): string {
  const base = "/" + pathname.split("/")[1];
  return ROUTE_LABELS[base] ?? "FinAI";
}

export function Topbar({ onOpenChat }: { onOpenChat?: () => void }) {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-12 right-0 z-30 h-11 border-b border-border bg-bg/80 backdrop-blur-md flex items-center px-4 gap-3">
      <span className="text-[13px] font-medium text-fg">{getBreadcrumb(pathname)}</span>

      <div className="ml-auto flex items-center gap-2">
        <CommandPalette />

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onOpenChat}
          className="text-fg-muted hover:text-accent"
          title="Open AI Chat (⌘K)"
        >
          <MessageSquare className="h-4 w-4" />
        </Button>

        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
