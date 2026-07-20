import Link from "next/link";
import { Factory, PackagePlus, Printer, Search, Truck } from "lucide-react";

const actions = [
  { title: "Analyze Product", href: "/opportunity-analyzer", icon: Search },
  { title: "Add Inventory", href: "/catalog", icon: PackagePlus },
  { title: "Suppliers", href: "/catalog", icon: Factory },
  { title: "Orders", href: "/logistics", icon: Truck },
  { title: "Print Labels", href: "/logistics", icon: Printer },
];

export function QuickActions() {
  return <div className="faust-surface p-6"><h2 className="text-lg font-semibold">Quick Actions</h2><p className="mt-1 text-sm text-muted-foreground">Jump into your most common tasks.</p><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{actions.map(({ title, href, icon: Icon }) => <Link key={title} href={href} className="faust-card flex flex-col items-center justify-center p-6 text-center transition hover:-translate-y-0.5 hover:border-sky-400/35"><Icon className="mb-3 h-8 w-8 text-sky-200" /><span className="text-sm font-medium">{title}</span></Link>)}</div></div>;
}
