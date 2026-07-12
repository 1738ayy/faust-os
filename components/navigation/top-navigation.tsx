"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";

export function TopNavigation() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-800 px-6">
      <div className="flex items-center gap-3">
        <SidebarTrigger />

        <div>
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <p className="text-sm text-zinc-500">
            Business Operating System
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="rounded-lg border border-zinc-800 px-3 py-2 text-sm hover:bg-zinc-900 transition-colors">
          Notifications
        </button>

        <div className="rounded-lg border border-zinc-800 px-4 py-2 text-sm">
          Henrry
        </div>
      </div>
    </header>
  );
}