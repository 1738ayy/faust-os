import {
  Boxes,
  DollarSign,
  LayoutDashboard,
  Package,
  Settings,
  BrainCircuit,
  Truck,
  Store,
} from "lucide-react";

export const primaryNavigation = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Catalog",
    href: "/catalog",
    icon: Package,
  },
  {
    title: "Operations",
    href: "/operations",
    icon: Boxes,
  },
  {
    title: "Finance",
    href: "/finance",
    icon: DollarSign,
  },
  {
    title: "Intelligence",
    href: "/intelligence",
    icon: BrainCircuit,
  },
  {
    title: "Logistics",
    href: "/logistics",
    icon: Truck,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export const marketplaces = [
  {
    title: "All Marketplaces",
    href: "/",
    icon: Store,
  },
  {
    title: "Depop",
    href: "/marketplace/depop",
  },
  {
    title: "Mercari",
    href: "/marketplace/mercari",
  },
  {
    title: "Poshmark",
    href: "/marketplace/poshmark",
  },
  {
    title: "eBay",
    href: "/marketplace/ebay",
  },
  {
    title: "Etsy",
    href: "/marketplace/etsy",
  },
];