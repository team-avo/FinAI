"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Phase 1B: Dashboard-only sidebar. Other surfaces are temporarily hidden
// while the Zoho integration is built — re-introduce as features ship.
const NAV = [{ href: "/dashboard", icon: Home, label: "Dashboard" }];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={300}>
      <nav className="fixed left-0 top-0 z-40 flex h-full w-12 flex-col items-center border-r border-border bg-bg py-3 gap-1">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex h-8 w-8 items-center justify-center rounded mb-3"
        >
          <Zap className="h-5 w-5 text-accent" strokeWidth={2.5} />
        </Link>

        <div className="flex flex-1 flex-col gap-0.5 w-full px-1.5">
          {NAV.map((item) => (
            <SidebarItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={pathname.startsWith(item.href)}
            />
          ))}
        </div>
      </nav>
    </TooltipProvider>
  );
}

function SidebarItem({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded transition-all duration-150",
            active
              ? "bg-accent/10 text-accent"
              : "text-fg-muted hover:text-fg hover:bg-bg-elevated",
          )}
        >
          {active && (
            <span className="absolute left-0 h-5 w-0.5 rounded-r bg-accent" />
          )}
          <Icon className="h-4 w-4" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
