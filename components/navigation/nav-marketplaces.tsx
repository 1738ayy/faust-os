"use client";

import Link from "next/link";

export function NavMarketplaces() {
  return <div className="mt-8 rounded-3xl border border-slate-700/50 bg-black/30 p-3 shadow-inner shadow-slate-950/10"><p className="text-xs font-medium text-zinc-300">Marketplace channels</p><p className="mt-1 text-xs leading-5 text-zinc-500">Depop, eBay, Etsy, Mercari, and Poshmark drafts now live together in Listings.</p><Link href="/listings" className="mt-3 inline-flex text-xs font-semibold text-[#c8d2e6] hover:text-[#edf3ff]">Open Listings</Link></div>;
}
