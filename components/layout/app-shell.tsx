import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { TopNavigation } from "./top-navigation";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <main className="flex min-h-screen bg-zinc-950 text-white">
      <Sidebar />

      <section className="flex-1 p-10">
        <TopNavigation />
        {children}
      </section>
    </main>
  );
}