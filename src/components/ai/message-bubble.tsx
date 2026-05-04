"use client";

import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; result?: unknown }>;
  createdAt?: Date;
}

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2.5 mb-4", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5",
          isUser ? "bg-bg-subtle border border-border" : "bg-accent/10 border border-accent/30",
        )}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5 text-fg-muted" />
        ) : (
          <Bot className="h-3.5 w-3.5 text-accent" />
        )}
      </div>

      <div className={cn("flex flex-col gap-1.5 max-w-[85%]", isUser && "items-end")}>
        {message.content && (
          <div
            className={cn(
              "rounded-md px-3 py-2 text-[13px] leading-relaxed",
              isUser
                ? "bg-bg-elevated border border-border text-fg"
                : "bg-accent/5 border border-accent/20 text-fg",
            )}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        )}

        {message.toolCalls?.map((tool, i) => (
          <ToolCallCard key={i} tool={tool} />
        ))}
      </div>
    </div>
  );
}

function ToolCallCard({
  tool,
}: {
  tool: { name: string; args: Record<string, unknown>; result?: unknown };
}) {
  return (
    <div className="rounded border border-border bg-bg-subtle px-3 py-2 text-[12px] font-mono">
      <div className="flex items-center gap-1.5 text-accent mb-1">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        <span className="font-medium">{tool.name}</span>
      </div>
      {tool.result !== undefined && (
        <div className="text-fg-muted mt-1 truncate">
          ✓ {typeof tool.result === "string" ? tool.result : JSON.stringify(tool.result).slice(0, 80)}
        </div>
      )}
    </div>
  );
}
