"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { marketplaces } from "@/lib/navigation";

export function NavMarketplaces() {
  const pathname = usePathname();
  return <div className="mt-8"><h2 className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Marketplaces</h2><nav className="space-y-1">{marketplaces.map((marketplace) => { const Icon = marketplace.icon; return <Link key={marketplace.title} href={marketplace.href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${pathname === marketplace.href ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"}`}><Icon className="h-4 w-4" /><span>{marketplace.title}</span></Link>; })}</nav></div>;
}
