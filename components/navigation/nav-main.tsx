"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { primaryNavigation, systemNavigation } from "@/lib/navigation";

const groups = [
  { label: "Run the business", items: primaryNavigation },
  { label: "System", items: systemNavigation },
];
export function NavMain() { const pathname = usePathname(); return <nav className="space-y-5">{groups.map((group) => <div key={group.label}><p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{group.label}</p><div className="space-y-1">{group.items.map((item) => { const Icon = item.icon; const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`)); return <Link key={item.title} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? "bg-emerald-400/12 text-emerald-100 ring-1 ring-emerald-400/30" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"}`}><Icon className="h-4 w-4" /><span>{item.title}</span></Link>; })}</div></div>)}</nav>; }
