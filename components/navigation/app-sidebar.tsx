"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

import { NavMain } from "./nav-main";
import { NavMarketplaces } from "./nav-marketplaces";

export function AppSidebar() {
  return (
    <Sidebar variant="inset">
      <SidebarHeader className="border-b border-zinc-800 p-4">
        <div>
          <h1 className="text-lg font-bold">Faust OS</h1>
          <p className="text-xs text-muted-foreground">
            Business Operating System
          </p>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-4">
        <NavMain />
        <NavMarketplaces />
      </SidebarContent>

      <SidebarFooter className="border-t border-zinc-800 p-4">
        <div>
          <p className="font-medium">Henrry Reyes</p>
          <p className="text-xs text-muted-foreground">
            Business Owner
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}