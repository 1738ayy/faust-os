import {
  LayoutDashboard,
  Search, Package, DollarSign, BrainCircuit, Truck, Settings, Store, ShoppingBag, Tags, Factory, BarChart3, Bot, Workflow, ClipboardList, Boxes,
} from "lucide-react";

export const primaryNavigation = [
  {
    title: "Mission Control",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Products",
    href: "/catalog",
    icon: Boxes,
  },
  {
    title: "Opportunities",
    href: "/sourcing",
    icon: Search,
  },
  { title: "Inventory", href: "/inventory", icon: Package },
  { title: "Orders", href: "/orders", icon: ShoppingBag },
  { title: "Listings", href: "/listings", icon: Tags },
  { title: "Purchasing", href: "/purchasing", icon: ClipboardList },
  { title: "Shipping", href: "/shipping", icon: Truck },
  { title: "Finance", href: "/finance", icon: DollarSign },
  { title: "Analytics", href: "/analytics", icon: BrainCircuit },
  { title: "Ask Faust", href: "/ai-center", icon: Bot },
];

export const systemNavigation = [
  { title: "Suppliers", href: "/suppliers", icon: Factory },
  { title: "Automations", href: "/automations", icon: Workflow },
  { title: "Reports", href: "/analytics", icon: BarChart3 },
  { title: "Settings", href: "/settings", icon: Settings },
];

export const utilityNavigation = [
  { title: "Customers", href: "/customers" },
  { title: "Tasks", href: "/tasks" },
  { title: "Search", href: "/search" },
  { title: "Opportunity Analyzer", href: "/opportunity-analyzer" },
];

export const marketplaces = [
  { title: "Depop", href: "/marketplace/depop", icon: Store },
  { title: "Mercari", href: "/marketplace/mercari", icon: Store },
  { title: "Poshmark", href: "/marketplace/poshmark", icon: Store },
  { title: "eBay", href: "/marketplace/ebay", icon: Store },
  { title: "Etsy", href: "/marketplace/etsy", icon: Store },
];
