"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { marketplaces } from "@/lib/navigation";

export function NavMarketplaces() {
  const pathname = usePathname();

  return (
    <div className="mt-8">
      <h2 className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Marketplaces
      </h2>

      <nav className="space-y-1">
        {marketplaces.map((marketplace) => {
          const Icon = marketplace.icon;
          const isActive = pathname === marketplace.href;

          return (
            <Link
              key={marketplace.title}
              href={marketplace.href}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                {Icon && <Icon className="h-4 w-4" />}
                <span>{marketplace.title}</span>
              </div>

              {/* Placeholder for live order count */}
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                —
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}