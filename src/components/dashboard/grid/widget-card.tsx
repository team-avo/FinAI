"use client";

import { GripVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface WidgetCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  editing?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  clickable?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function WidgetCard({
  title,
  subtitle,
  icon,
  editing,
  onRemove,
  onClick,
  clickable,
  className,
  children,
}: WidgetCardProps) {
  return (
    <div
      onClick={!editing && clickable ? onClick : undefined}
      className={cn(
        "group h-full flex flex-col overflow-hidden rounded-md border border-border bg-bg-elevated/80 backdrop-blur-sm transition-all",
        !editing && clickable && "cursor-pointer hover:border-accent/40 hover:bg-bg-elevated",
        editing && "ring-1 ring-accent/30",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border/60">
        {icon && (
          <div className="flex h-5 w-5 shrink-0 items-center justify-center text-fg-muted">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[12px] font-medium uppercase tracking-wider text-fg-muted">
              {title}
            </h3>
            {subtitle && (
              <span className="truncate text-[10px] font-mono text-fg-subtle">
                {subtitle}
              </span>
            )}
          </div>
        </div>

        {editing && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove?.();
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-fg-subtle hover:text-negative hover:bg-negative/10"
              aria-label="Remove widget"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <span
              className="widget-drag-handle flex h-5 w-5 items-center justify-center rounded text-fg-subtle hover:text-fg cursor-grab active:cursor-grabbing"
              aria-label="Drag to reposition"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto p-4">{children}</div>
    </div>
  );
}
