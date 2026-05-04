"use client";

import { useState } from "react";
import { ChatDock } from "@/components/ai/chat-dock";
import { GridBg } from "@/components/effects/grid-bg";
import { Bot, MessageSquare, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const CAPABILITIES = [
  "Create invoices from a simple message",
  "Record expenses by describing them",
  "Scan bill images and auto-fill expense forms",
  "Ask for P&L summaries and financial insights",
  "Check outstanding receivables",
  "Get expense breakdowns by category",
];

export default function ChatPage() {
  const [chatOpen, setChatOpen] = useState(true);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="relative rounded-md border border-border overflow-hidden bg-bg-elevated p-8 text-center">
        <GridBg className="opacity-30" />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 border border-accent/30">
            <Bot className="h-7 w-7 text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-fg">FinAI Assistant</h1>
            <p className="text-[13px] text-fg-muted mt-0.5">
              Your AI-powered accounting assistant
            </p>
          </div>
          <Button onClick={() => setChatOpen(true)} className="mt-2">
            <MessageSquare className="h-4 w-4" />
            Open Chat
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CAPABILITIES.map((cap) => (
          <div
            key={cap}
            className="flex items-start gap-2.5 rounded border border-border bg-bg-elevated p-3"
          >
            <Zap className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <span className="text-[13px] text-fg">{cap}</span>
          </div>
        ))}
      </div>

      <ChatDock open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
