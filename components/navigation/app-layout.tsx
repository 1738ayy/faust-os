"use client";

import { ReactNode } from "react";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { TopNavigation } from "./top-navigation";

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />

      <SidebarInset>
        <TopNavigation />

        <main className="flex flex-1 flex-col p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}