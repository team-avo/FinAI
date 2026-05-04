import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function ShimmerSkeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded bg-bg-elevated",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-[shimmer_1.6s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/[0.04] before:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

export function SkeletonText({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <ShimmerSkeleton className={cn("h-3 rounded-sm", className)} {...props} />;
}

export function SkeletonBlock({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <ShimmerSkeleton className={cn("h-8 rounded", className)} {...props} />;
}
