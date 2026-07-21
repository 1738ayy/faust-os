"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

import { NavMain } from "./nav-main";
import { NavMarketplaces } from "./nav-marketplaces";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { FaustLogo } from "@/components/brand/faust-logo";

export function AppSidebar() {
  return (
    <Sidebar variant="inset">
      <SidebarHeader className="border-b border-slate-700/50 bg-black/20 p-5">
        <div className="flex flex-col items-center text-center">
          <FaustLogo className="h-[6.5rem] w-48" />
          <div className="mt-1">
            <h1 className="font-heading text-xl font-bold tracking-tight">Faust OS</h1>
            <p className="text-xs text-muted-foreground">
              Business Operating System
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-4">
        <NavMain />
        <NavMarketplaces />
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-700/50 bg-black/20 p-4">
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
