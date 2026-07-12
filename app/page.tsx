import { AppLayout } from "@/components/navigation/app-layout";
import { StatCard } from "@/components/dashboard/stat-card";

export default function Home() {
  return (
    <AppLayout>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Revenue Today" value="$0.00" />
        <StatCard title="Profit Today" value="$0.00" />
        <StatCard title="Orders" value="0" />
        <StatCard title="Cash Available" value="$0.00" />
      </div>
    </AppLayout>
  );
}