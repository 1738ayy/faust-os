import { Activity, Boxes, DollarSign, ShoppingCart } from "lucide-react";

const metrics = [
  { label: "Revenue", status: "No sales yet", icon: DollarSign },
  { label: "Inventory", status: "Awaiting imports", icon: Boxes },
  { label: "Orders", status: "No orders yet", icon: ShoppingCart },
];

export function BusinessHealth() {
  return <div className="faust-surface p-6"><div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">Business Health</h2><p className="text-sm text-muted-foreground">A live summary as your business data arrives</p></div><Activity className="h-6 w-6 text-red-300" /></div><div className="mt-8 flex justify-center"><div className="flex h-36 w-36 items-center justify-center rounded-full border-8 border-red-950/45 bg-black/25 shadow-inner shadow-red-950/20"><div className="text-center"><p className="font-heading text-4xl font-semibold">—</p><p className="text-sm text-muted-foreground">No data</p></div></div></div><div className="mt-8 space-y-3">{metrics.map(({ label, status, icon: Icon }) => <div key={label} className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Icon className="h-4 w-4 text-red-300" /><span>{label}</span></div><span className="text-sm text-muted-foreground">{status}</span></div>)}</div></div>;
}
