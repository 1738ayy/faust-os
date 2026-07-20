"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { primaryNavigation, systemNavigation } from "@/lib/navigation";

const groups = [
  { label: "Daily workflow", items: primaryNavigation },
  { label: "More tools", items: systemNavigation },
];
export function NavMain() { const pathname = usePathname(); return <nav className="space-y-5">{groups.map((group) => <div key={group.label}><p className="mb-2 px-2 text-[11px] font-medium text-zinc-500">{group.label}</p><div className="space-y-1">{group.items.map((item) => { const Icon = item.icon; const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`)); return <Link key={item.title} href={item.href} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all ${active ? "bg-[#66708d]/12 text-[#f6f8ff] ring-1 ring-[#8f9bb8]/30 shadow-lg shadow-slate-950/10" : "text-zinc-400 hover:bg-slate-800/20 hover:text-white"}`}><Icon className="h-4 w-4" /><span>{item.title}</span></Link>; })}</div></div>)}</nav>; }
