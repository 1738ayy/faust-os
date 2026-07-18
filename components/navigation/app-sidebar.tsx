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

export function AppSidebar() {
  return (
    <Sidebar variant="inset">
      <SidebarHeader className="border-b border-zinc-800/80 p-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Faust OS</h1>
          <p className="text-xs text-muted-foreground">
            Daily operating cockpit
          </p>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-4">
        <NavMain />
        <NavMarketplaces />
      </SidebarContent>

      <SidebarFooter className="border-t border-zinc-800/80 p-4">
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
