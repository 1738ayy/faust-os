"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Plus, Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

const titles: Record<string, string> = {
  "/": "Mission Control",
  "/catalog": "Products",
  "/inventory": "Inventory",
  "/orders": "Orders",
  "/listings": "Listings",
  "/sourcing": "Opportunities",
  "/purchasing": "Purchasing",
  "/shipping": "Shipping",
  "/finance": "Finance",
  "/suppliers": "Suppliers",
  "/customers": "Customers",
  "/analytics": "Analytics",
  "/automations": "Automations",
  "/ai-center": "Ask Faust",
  "/tasks": "Tasks",
  "/opportunity-analyzer": "Opportunity Analyzer",
  "/settings": "Settings",
};

function environmentLabel() {
  const value = process.env.NEXT_PUBLIC_FAUST_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV || "local";
  if (value === "production") return "Production";
  if (value === "preview" || value === "staging") return "Staging";
  return "Local workspace";
}

export function TopNavigation() {
  const pathname = usePathname();
  const title = titles[pathname] || "Faust OS";
  return <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b border-zinc-800/70 bg-background/85 px-4 backdrop-blur sm:px-6"><div className="flex min-w-0 items-center gap-3"><SidebarTrigger /><div className="min-w-0"><h1 className="truncate text-base font-semibold">{title}</h1><p className="hidden text-xs text-zinc-500 sm:block">Business workspace · {environmentLabel()}</p></div></div><div className="flex items-center gap-2"><Link href="/search" className="hidden items-center gap-2 rounded-full border border-zinc-800 px-3 py-2 text-xs text-zinc-400 hover:border-zinc-600 md:flex"><Search size={14} />Search</Link><Link href="/tasks" aria-label="Open notifications" className="rounded-full border border-zinc-800 p-2 text-zinc-300 hover:border-zinc-600"><Bell size={15} /></Link><Link href="/sourcing" className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-3 py-2 text-xs font-semibold text-zinc-950"><Plus size={15} />Import</Link></div></header>;
}
