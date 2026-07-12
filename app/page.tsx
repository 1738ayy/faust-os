import { Sidebar } from "@/components/layout/sidebar";
import { StatCard } from "@/components/dashboard/stat-card";

export default function Home() {
  return (
    <main className="flex min-h-screen bg-zinc-950 text-white">
      <Sidebar />

      <section className="flex-1 p-10">
        <h1 className="text-4xl font-bold">Dashboard</h1>

        <p className="mt-3 text-zinc-400">
          Welcome back, Henrry.
        </p>

        <div className="mt-8 grid grid-cols-4 gap-6">
          <StatCard title="Revenue Today" value="$0.00" />
          <StatCard title="Profit Today" value="$0.00" />
          <StatCard title="Orders" value="0" />
          <StatCard title="Cash Available" value="$0.00" />
        </div>
      </section>
    </main>
  );
}