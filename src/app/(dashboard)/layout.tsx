"use client";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { ChatDock } from "@/components/ai/chat-dock";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="flex h-screen bg-bg text-fg overflow-hidden">
      <Sidebar />

      <div className="flex flex-col flex-1 ml-12 min-w-0">
        <Topbar onOpenChat={() => setChatOpen(true)} />

        <main className="flex-1 overflow-auto pt-11">
          <div className="p-5">{children}</div>
        </main>
      </div>

      <ChatDock open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
