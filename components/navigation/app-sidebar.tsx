"use client";

import Image from "next/image";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

import { NavMain } from "./nav-main";
import { NavMarketplaces } from "./nav-marketplaces";
import { SignOutButton } from "@/components/auth/sign-out-button";

export function AppSidebar() {
  return (
    <Sidebar variant="inset">
      <SidebarHeader className="border-b border-red-950/50 bg-black/20 p-5">
        <div className="flex flex-col items-center text-center">
          <Image
            alt="Faust OS logo"
            src="/brand/faust-logo.png"
            width={72}
            height={72}
            className="h-20 w-20 rounded-3xl border border-red-500/20 object-contain p-1 shadow-xl shadow-red-950/30"
          />
          <div className="mt-3">
            <h1 className="font-heading text-xl font-bold tracking-tight">Faust OS</h1>
            <p className="text-xs text-muted-foreground">
              Daily operating cockpit
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-4">
        <NavMain />
        <NavMarketplaces />
      </SidebarContent>

      <SidebarFooter className="border-t border-red-950/50 bg-black/20 p-4">
        <div>
          <p className="font-medium">Henrry Reyes</p>
          <p className="text-xs text-muted-foreground">
            Business Owner
          </p>
          <div className="mt-2"><SignOutButton /></div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
