import { BadgeDollarSign, ShoppingBag, Store } from "lucide-react";

const marketplaces = [
  { name: "Depop", icon: BadgeDollarSign },
  { name: "Mercari", icon: Store },
  { name: "Poshmark", icon: ShoppingBag },
  { name: "eBay", icon: Store },
  { name: "Etsy", icon: Store },
];

export function MarketplaceOverview() {
  return <div className="faust-surface p-6"><h2 className="text-lg font-semibold">Marketplace Overview</h2><div className="mt-6 space-y-4">{marketplaces.map(({ name, icon: Icon }) => <div key={name} className="flex items-center justify-between rounded-2xl border border-slate-700/35 bg-black/35 p-4 transition-colors hover:border-slate-400/35"><div className="flex items-center gap-4"><Icon className="h-6 w-6 text-[#c8d2e6]" /><div><p className="font-medium">{name}</p><p className="text-sm text-muted-foreground">Not connected</p></div></div><p className="text-sm text-muted-foreground">—</p></div>)}</div></div>;
}
