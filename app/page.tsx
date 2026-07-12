import { AppLayout } from "@/components/navigation/app-layout";
import { StatCard } from "@/components/dashboard/stat-card";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { InventoryAlerts } from "@/components/dashboard/inventory-alerts";
import { Notifications } from "@/components/dashboard/notifications";
import { MarketplaceOverview } from "@/components/dashboard/marketplace-overview";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import {
  DollarSign,
  Wallet,
  ShoppingCart,
  PiggyBank,
} from "lucide-react";

export default function Home() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Revenue Today"
            value="$0.00"
            subtitle="No sales yet"
            icon={<DollarSign size={20} />}
          />

          <StatCard
            title="Profit Today"
            value="$0.00"
            subtitle="Waiting for orders"
            icon={<Wallet size={20} />}
          />

          <StatCard
            title="Orders"
            value="0"
            subtitle="Nothing to ship"
            icon={<ShoppingCart size={20} />}
          />

          <StatCard
            title="Cash Available"
            value="$0.00"
            subtitle="Ready for reinvestment"
            icon={<PiggyBank size={20} />}
          />
        </div>

        <RevenueChart />

        <div className="grid gap-6 lg:grid-cols-3">
          <RecentOrders />
          <InventoryAlerts />
          <Notifications />
        </div>

        <MarketplaceOverview />
      </div>
    </AppLayout>
  );
}