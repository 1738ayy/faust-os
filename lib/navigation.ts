import {
  LayoutDashboard,
  Search, Package, DollarSign, BrainCircuit, Truck, Settings, Store, ShoppingBag, Tags, Factory, Users, Bot, ListTodo, Workflow, ClipboardList,
} from "lucide-react";

export const primaryNavigation = [
  {
    title: "Mission Control",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Sourcing",
    href: "/sourcing",
    icon: Search,
  },
  { title: "Inventory", href: "/inventory", icon: Package },
  { title: "Orders", href: "/orders", icon: ShoppingBag },
  { title: "Listings", href: "/listings", icon: Tags },
  { title: "Purchasing", href: "/purchasing", icon: ClipboardList },
  { title: "Shipping", href: "/shipping", icon: Truck },
  { title: "Finance", href: "/finance", icon: DollarSign },
  { title: "Suppliers", href: "/suppliers", icon: Factory },
  { title: "Customers", href: "/customers", icon: Users },
  { title: "Analytics", href: "/analytics", icon: BrainCircuit },
  { title: "Automations", href: "/automations", icon: Workflow },
  { title: "AI Center", href: "/ai-center", icon: Bot },
  { title: "Tasks", href: "/tasks", icon: ListTodo },
  { title: "Global Search", href: "/search", icon: Search },
  { title: "Settings", href: "/settings", icon: Settings },
  /* Legacy paths are kept in place for existing saved links. */
  { title: "Opportunity Analyzer", href: "/opportunity-analyzer", icon: Search },
];

export const marketplaces = [
  { title: "Depop", href: "/marketplace/depop", icon: Store },
  { title: "Mercari", href: "/marketplace/mercari", icon: Store },
  { title: "Poshmark", href: "/marketplace/poshmark", icon: Store },
  { title: "eBay", href: "/marketplace/ebay", icon: Store },
  { title: "Etsy", href: "/marketplace/etsy", icon: Store },
];
