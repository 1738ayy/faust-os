"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { primaryNavigation } from "@/lib/navigation";

const groups = [
  { label: "Operate", names: ["Mission Control", "Orders", "Inventory", "Listings", "Shipping", "Tasks"] },
  { label: "Grow", names: ["Sourcing", "Purchasing", "Suppliers", "Customers"] },
  { label: "Understand", names: ["Finance", "Analytics", "AI Center", "Automations"] },
  { label: "System", names: ["Global Search", "Settings", "Opportunity Analyzer"] },
];
export function NavMain() { const pathname = usePathname(); return <nav className="space-y-5">{groups.map((group) => <div key={group.label}><p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{group.label}</p><div className="space-y-0.5">{primaryNavigation.filter((item) => group.names.includes(item.title)).map((item) => { const Icon = item.icon; const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`)); return <Link key={item.title} href={item.href} className={`flex items-center gap-3 px-2.5 py-2 text-sm transition-colors ${active ? "border-l-2 border-emerald-400 bg-zinc-800/80 text-white" : "border-l-2 border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-white"}`}><Icon className="h-4 w-4" /><span>{item.title}</span></Link>; })}</div></div>)}</nav>; }
