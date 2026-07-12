import { AppLayout } from "@/components/navigation/app-layout";
import { StatCard } from "@/components/dashboard/stat-card";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { Notifications } from "@/components/dashboard/notifications";

export default function Home() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Revenue Today" value="$0.00" />
          <StatCard title="Profit Today" value="$0.00" />
          <StatCard title="Orders" value="0" />
          <StatCard title="Cash Available" value="$0.00" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <RecentOrders />
          <Notifications />
        </div>
      </div>
    </AppLayout>
  );
}