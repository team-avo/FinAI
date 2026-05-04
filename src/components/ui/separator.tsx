import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SeparatorProps extends HTMLAttributes<HTMLHRElement> {
  orientation?: "horizontal" | "vertical";
}

export function Separator({ className, orientation = "horizontal", ...props }: SeparatorProps) {
  return (
    <hr
      className={cn(
        "border-border",
        orientation === "horizontal" ? "border-t w-full" : "border-l h-full",
        className,
      )}
      {...props}
    />
  );
}
