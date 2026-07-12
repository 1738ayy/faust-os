"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { primaryNavigation } from "@/lib/navigation";

export function NavMain() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {primaryNavigation.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.title}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span>{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}