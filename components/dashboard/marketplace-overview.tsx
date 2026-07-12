import {
  BadgeDollarSign,
  ShoppingBag,
  Store,
} from "lucide-react";

const marketplaces = [
  {
    name: "Depop",
    revenue: "$482",
    orders: 14,
    change: "+18%",
    color: "text-purple-400",
    icon: BadgeDollarSign,
  },
  {
    name: "Mercari",
    revenue: "$41",
    orders: 2,
    change: "-5%",
    color: "text-blue-400",
    icon: Store,
  },
  {
    name: "Poshmark",
    revenue: "$197",
    orders: 6,
    change: "+11%",
    color: "text-rose-400",
    icon: ShoppingBag,
  },
  {
    name: "eBay",
    revenue: "$351",
    orders: 9,
    change: "+7%",
    color: "text-yellow-400",
    icon: Store,
  },
  {
    name: "Etsy",
    revenue: "$0",
    orders: 0,
    change: "--",
    color: "text-green-400",
    icon: Store,
  },
];

export function MarketplaceOverview() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold">Marketplace Overview</h2>

      <div className="mt-6 space-y-4">
        {marketplaces.map((marketplace) => {
          const Icon = marketplace.icon;

          return (
            <div
              key={marketplace.name}
              className="flex items-center justify-between rounded-lg border border-zinc-800 p-4 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center gap-4">
                <Icon className={`h-6 w-6 ${marketplace.color}`} />

                <div>
                  <p className="font-medium">{marketplace.name}</p>
                  <p className="text-sm text-zinc-500">
                    {marketplace.orders} Orders
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="font-semibold">{marketplace.revenue}</p>
                <p className="text-sm text-zinc-500">
                  {marketplace.change}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}