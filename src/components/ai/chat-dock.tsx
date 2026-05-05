"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, X, Loader2 } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./message-bubble";
import { GlowBorder } from "@/components/effects/glow-border";

function getMessageText(msg: UIMessage): string {
  return msg.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("");
}

export function ChatDock({ open, onClose }: { open: boolean; onClose: () => void }) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/ai/chat" }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-[400px] flex-col",
          "border-l border-border bg-bg shadow-2xl",
          "animate-in slide-in-from-right duration-200",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 h-11 border-b border-border">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 border border-accent/30">
            <Bot className="h-3.5 w-3.5 text-accent" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-fg">FinAI Assistant</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto text-fg-muted"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center mb-3">
                <Bot className="h-6 w-6 text-accent" />
              </div>
              <p className="text-[13px] font-medium text-fg">How can I help?</p>
              <p className="text-[12px] text-fg-muted mt-1 max-w-[200px]">
                Create invoices, record expenses, or ask financial questions.
              </p>
              <div className="mt-4 flex flex-col gap-1.5 w-full max-w-[260px]">
                {[
                  "Show me this month's P&L",
                  "Record ₹500 expense for Swiggy",
                  "Create invoice for Acme Corp",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    className="text-left rounded border border-border px-3 py-2 text-[12px] text-fg-muted hover:border-border-strong hover:text-fg transition-colors"
                    onClick={() => {
                      setInput(prompt);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={{
                id: msg.id,
                role: msg.role as "user" | "assistant",
                content: getMessageText(msg),
              }}
            />
          ))}

          {isLoading && (
            <div className="flex gap-2.5 mb-4">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 border border-accent/30 mt-0.5">
                <Loader2 className="h-3.5 w-3.5 text-accent animate-spin" />
              </div>
              <div className="rounded-md px-3 py-2 bg-accent/5 border border-accent/20">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border p-3">
          <form onSubmit={handleSubmit}>
            <GlowBorder className="rounded-md">
              <div className="flex items-end gap-2 rounded-md border border-border bg-bg-elevated p-2">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything..."
                  className="flex-1 resize-none bg-transparent text-[13px] text-fg placeholder:text-fg-subtle focus:outline-none min-h-[24px] max-h-32"
                  style={{ height: "auto" }}
                />
                <Button
                  type="submit"
                  size="icon-sm"
                  disabled={!input.trim() || isLoading}
                  className="shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </GlowBorder>
          </form>
          <p className="text-[11px] text-fg-subtle mt-1.5 text-center">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
}
