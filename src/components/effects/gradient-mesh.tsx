import { cn } from "@/lib/utils";

interface GradientMeshProps {
  className?: string;
}

export function GradientMesh({ className }: GradientMeshProps) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden
    >
      {/* Primary lime orb — top-left */}
      <div
        className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full opacity-[0.05]"
        style={{
          background: "radial-gradient(circle, var(--color-accent) 0%, transparent 70%)",
          filter: "blur(60px)",
          animation: "pulse-glow 6s ease-in-out infinite",
        }}
      />
      {/* Secondary orb — bottom-right */}
      <div
        className="absolute -bottom-32 -right-20 h-[400px] w-[400px] rounded-full opacity-[0.04]"
        style={{
          background: "radial-gradient(circle, var(--color-info) 0%, transparent 70%)",
          filter: "blur(80px)",
          animationDelay: "3s",
          animation: "pulse-glow 8s ease-in-out infinite",
        }}
      />
    </div>
  );
}
