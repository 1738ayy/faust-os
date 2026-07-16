const marketplaces = ["Depop", "eBay", "Etsy", "Mercari", "Poshmark"];
const financeAccounts = ["Operating Cash", "Marketplace Clearing", "Inventory Asset", "Tax Reserve", "Owner Equity"];
const financeCategories = ["Sales", "COGS", "Marketplace Fees", "Payment Fees", "Shipping Expense", "Packaging", "Inventory Purchase", "Freight", "Duty", "Software", "Advertising", "Tax Reserve"];
const automationTemplates = [
  "Low stock → reorder recommendation → approval → draft PO",
  "Failed listing sync → retry → risk lock → notification → dead letter",
  "Sale imported → reserve inventory → sibling delist queue → fulfillment task",
  "Deployable cash threshold → reinvestment simulation → approval",
];

console.log(JSON.stringify({
  ok: true,
  mode: process.env.FAUST_ENV || "local",
  sequence: [
    "Create Supabase project and enable Email/Password Auth.",
    "Apply supabase/migrations/*.sql in ascending numeric order.",
    "Create first admin user in Supabase Auth.",
    "Call create_business_with_defaults through the app onboarding flow.",
    "Seed default marketplace accounts, finance accounts/categories, automation templates, and storage buckets.",
    "Register staging extension device; verify /api/health.",
  ],
  defaultMarketplaceAccounts: marketplaces.map((marketplace) => ({ marketplace, status: "extension_assisted", liveCredentials: "not_connected" })),
  defaultFinanceAccounts: financeAccounts,
  defaultFinanceCategories: financeCategories,
  defaultAutomationTemplates: automationTemplates,
  safeDemoSeed: "Use local development_demo reset only. Do not run demo seed against production.",
}, null, 2));
