import type { Budget, Expense, Forecast, FinanceCategory, FinancialAccount, OperatingData, Order, Payout, PayoutReconciliation, ReinvestmentAllocation, TaxReserveMovement, Transaction } from "@/domain/business";
import { inventoryValue, orderProfit } from "./business-calculations";

const now = () => new Date().toISOString();
const monthKey = (date = new Date()) => date.toISOString().slice(0, 7);
const round = (value: number) => Math.round(value * 100) / 100;
const sum = <T>(items: T[], selector: (item: T) => number) => round(items.reduce((total, item) => total + selector(item), 0));
export function deterministicUuid(seed: string) {
  let state = 0x811c9dc5;
  const bytes = Array.from({ length: 16 }, (_, index) => {
    for (let offset = 0; offset < seed.length; offset++) state = Math.imul(state ^ seed.charCodeAt(offset) ^ index, 16777619) >>> 0;
    return state & 0xff;
  });
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export const financeAccountIds = {
  operatingCash: deterministicUuid("financial-account:cash-main"),
  marketplaceClearing: deterministicUuid("financial-account:marketplace-clearing"),
  taxReserve: deterministicUuid("financial-account:tax-reserve"),
  externalVendor: deterministicUuid("financial-account:external-vendor"),
};

export type FinanceLedgerEntry = Transaction & { sourceLabel: string; sourceHref?: string };
export type OrderReconciliation = ReturnType<typeof reconcileOrder>;
export type DeployableCashComponent = { label: string; amount: number; sourceType: string; sourceIds: string[] };

export function defaultFinanceCategories(createdAt = now()): FinanceCategory[] {
  return [
    ["Sales", "income"], ["Refunds", "income"], ["COGS", "cogs"], ["Marketplace fees", "fee"], ["Payment fees", "fee"], ["Shipping revenue", "income"], ["Shipping expense", "expense"], ["Packaging", "expense"], ["Inventory purchases", "asset"], ["Freight", "cogs"], ["Duty", "cogs"], ["Software", "expense"], ["Advertising", "expense"], ["Payouts", "transfer"], ["Tax reserve", "tax"], ["Owner equity", "equity"], ["Adjustments", "transfer"],
  ].map(([name, type]) => ({ id: deterministicUuid(`finance-category:${name}`), name, type: type as FinanceCategory["type"], taxDeductible: ["Software", "Advertising", "Shipping expense", "Packaging", "Freight", "Duty"].includes(name), createdAt }));
}

export function defaultFinancialAccounts(createdAt = now()): FinancialAccount[] {
  return [
    { id: financeAccountIds.operatingCash, name: "Operating cash", type: "cash", currency: "USD", openingBalance: 0, currentBalance: 0, status: "active", createdAt },
    { id: financeAccountIds.marketplaceClearing, name: "Marketplace clearing", type: "marketplace_clearing", currency: "USD", openingBalance: 0, currentBalance: 0, status: "active", createdAt },
    { id: financeAccountIds.taxReserve, name: "Tax reserve", type: "tax_reserve", currency: "USD", openingBalance: 0, currentBalance: 0, status: "active", createdAt },
    { id: financeAccountIds.externalVendor, name: "External vendor payable", type: "credit_card", currency: "USD", openingBalance: 0, currentBalance: 0, status: "active", createdAt },
  ];
}

export function reconcileOrder(order: Order, data: OperatingData) {
  const profit = orderProfit(order, data.variants);
  const lineLevel = profit.lineContributions.map((line) => {
    const item = order.items.find((entry) => entry.id === line.itemId);
    return { ...line, title: item?.title || "Order line", quantity: item?.quantity || 0, sourceId: line.itemId };
  });
  return {
    orderId: order.id,
    number: order.number,
    marketplace: order.marketplace,
    grossSale: profit.grossSales,
    discounts: profit.discounts,
    refunds: profit.refunds,
    netSale: profit.netSales,
    cogs: profit.cogs,
    marketplaceFees: profit.marketplaceFees,
    paymentFees: profit.paymentFees,
    sellerPaidShipping: profit.sellerShipping,
    packaging: profit.packaging,
    advertisingAllocation: profit.advertising,
    grossProfit: profit.grossProfit,
    contributionProfit: profit.contributionProfit,
    margin: profit.margin,
    lineLevel,
    sourceIds: [order.id, ...order.items.map((item) => item.id)],
  };
}

export function orderLedgerEntries(order: Order, data: OperatingData): FinanceLedgerEntry[] {
  const reconciliation = reconcileOrder(order, data);
  const base = { orderId: order.id, occurredAt: order.paidAt || order.orderedAt, status: "cleared" as const, sourceType: "order" as const, sourceId: order.id, sourceLabel: `${order.number} · ${order.marketplace}`, sourceHref: `/orders` };
  const entries: FinanceLedgerEntry[] = [
    { id: `order:${order.id}:sale`, type: "sale", amount: reconciliation.grossSale, description: `${order.number} gross sale`, category: "Sales", ...base },
    { id: `order:${order.id}:shipping-revenue`, type: "shipping_revenue", amount: order.shippingCharged, description: `${order.number} shipping charged`, category: "Shipping revenue", ...base },
    { id: `order:${order.id}:cogs`, type: "inventory_purchase", amount: -reconciliation.cogs, description: `${order.number} COGS recognized`, category: "COGS", ...base },
    { id: `order:${order.id}:marketplace-fee`, type: "marketplace_fee", amount: -reconciliation.marketplaceFees, description: `${order.number} marketplace fees`, category: "Marketplace fees", ...base },
    { id: `order:${order.id}:payment-fee`, type: "payment_fee", amount: -reconciliation.paymentFees, description: `${order.number} payment fees`, category: "Payment fees", ...base },
    { id: `order:${order.id}:shipping-expense`, type: "shipping_expense", amount: -order.shippingCost, description: `${order.number} seller-paid shipping`, category: "Shipping expense", ...base },
  ];
  if (order.packagingCost) entries.push({ id: `order:${order.id}:packaging`, type: "packaging", amount: -order.packagingCost, description: `${order.number} packaging`, category: "Packaging", ...base });
  if (order.advertisingCost) entries.push({ id: `order:${order.id}:advertising`, type: "advertising", amount: -order.advertisingCost, description: `${order.number} advertising allocation`, category: "Advertising", ...base });
  for (const refund of order.refunds || []) entries.push({ id: `refund:${refund.id}`, type: "refund", amount: -refund.amount, description: `${order.number} refund: ${refund.reason}`, category: "Refunds", orderId: order.id, orderItemId: refund.itemId, occurredAt: refund.refundedAt, status: "cleared", sourceType: "refund", sourceId: refund.id, sourceLabel: `${order.number} refund`, sourceHref: "/orders" });
  return entries.filter((entry) => entry.amount !== 0);
}

export function buildFinanceLedger(data: OperatingData): FinanceLedgerEntry[] {
  const explicit = data.transactions.map<FinanceLedgerEntry>((transaction) => ({ ...transaction, sourceLabel: transaction.orderId ? data.orders.find((order) => order.id === transaction.orderId)?.number || "Order" : transaction.purchaseOrderId ? data.purchaseOrders.find((po) => po.id === transaction.purchaseOrderId)?.reference || "Purchase order" : transaction.payoutId ? data.payouts?.find((payout) => payout.id === transaction.payoutId)?.externalPayoutId || "Payout" : transaction.expenseId ? data.expenses?.find((expense) => expense.id === transaction.expenseId)?.vendor || "Expense" : "Manual transaction", sourceHref: transaction.orderId ? "/orders" : transaction.purchaseOrderId ? "/purchasing" : transaction.payoutId || transaction.expenseId ? "/finance" : undefined }));
  const existing = new Set(explicit.map((entry) => entry.id));
  const generated = data.orders.flatMap((order) => orderLedgerEntries(order, data)).filter((entry) => !existing.has(entry.id));
  return [...explicit, ...generated].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function buildFinanceModel(data: OperatingData) {
  const ledger = buildFinanceLedger(data);
  const reconciliations = data.orders.map((order) => reconcileOrder(order, data));
  const expenses = normalizeExpenses(data, ledger);
  const payouts = normalizePayouts(data, ledger);
  const payoutReconciliations = normalizePayoutReconciliations(data, payouts);
  const budgets = normalizeBudgets(data, expenses);
  const taxReserve = normalizeTaxReserve(data, reconciliations);
  const allocations = normalizeReinvestment(data);
  const forecasts = normalizeForecasts(data, reconciliations, payouts, budgets);
  const overview = buildFinanceOverview(data, ledger, reconciliations, payouts, budgets, taxReserve);
  return { ledger, reconciliations, expenses, payouts, payoutReconciliations, budgets, taxReserve, allocations, forecasts, overview };
}

function normalizeExpenses(data: OperatingData, ledger: FinanceLedgerEntry[]): Expense[] {
  const stored = data.expenses || [];
  const fromLedger = ledger.filter((entry) => entry.amount < 0 && ["shipping_expense", "packaging", "software", "advertising", "freight", "duty", "expense"].includes(entry.type) && !stored.some((expense) => expense.transactionId === entry.id)).map<Expense>((entry) => ({ id: deterministicUuid(`expense:${entry.id}`), vendor: entry.description.split(" ").slice(0, 3).join(" "), category: entry.category, amount: Math.abs(entry.amount), date: entry.occurredAt, recurring: entry.type === "software" ? "monthly" : "none", taxDeductible: !["owner_withdrawal", "transfer"].includes(entry.type), receiptStatus: "pending_attachment", orderId: entry.orderId, notes: `Generated from ${entry.sourceLabel}.`, transactionId: entry.id, createdAt: entry.occurredAt }));
  return [...stored, ...fromLedger];
}

function normalizePayouts(data: OperatingData, ledger: FinanceLedgerEntry[]): Payout[] {
  if (data.payouts?.length) return data.payouts;
  const byMarketplace = new Map<string, FinanceLedgerEntry[]>();
  ledger.filter((entry) => entry.orderId && ["sale", "refund", "marketplace_fee", "payment_fee", "shipping_expense"].includes(entry.type)).forEach((entry) => {
    const order = data.orders.find((item) => item.id === entry.orderId);
    if (!order) return;
    byMarketplace.set(order.marketplace, [...(byMarketplace.get(order.marketplace) || []), entry]);
  });
  return [...byMarketplace.entries()].map(([marketplace, entries]) => {
    const amount = sum(entries, (entry) => entry.amount);
    const orderIds = [...new Set(entries.map((entry) => entry.orderId).filter(Boolean))] as string[];
    return { id: deterministicUuid(`payout:${marketplace.toLowerCase()}:${monthKey()}`), marketplace: marketplace as Payout["marketplace"], status: "expected", expectedAmount: amount, fees: Math.abs(sum(entries.filter((entry) => entry.type.includes("fee")), (entry) => entry.amount)), adjustments: 0, orderIds, transactionIds: entries.map((entry) => entry.id), expectedAt: new Date(Date.now() + 3 * 86400000).toISOString(), createdAt: now() };
  });
}

function normalizePayoutReconciliations(data: OperatingData, payouts: Payout[]): PayoutReconciliation[] {
  if (data.payoutReconciliations?.length) return data.payoutReconciliations;
  return payouts.map((payout) => {
    const actual = payout.actualAmount ?? payout.expectedAmount;
    const discrepancy = round(actual - payout.expectedAmount);
    return { id: deterministicUuid(`recon:${payout.id}`), payoutId: payout.id, status: discrepancy ? "discrepancy" : payout.status === "reconciled" ? "matched" : "open", expectedAmount: payout.expectedAmount, actualAmount: actual, discrepancyAmount: discrepancy, includedOrderIds: payout.orderIds, feeTransactionIds: payout.transactionIds.filter((id) => id.includes("fee")), adjustmentTransactionIds: payout.transactionIds.filter((id) => id.includes("adjustment")), audit: [`${now()}: Expected payout calculated from ${payout.orderIds.length} order(s).`], createdAt: now() };
  });
}

function normalizeBudgets(data: OperatingData, expenses: Expense[]): Budget[] {
  const stored = data.budgets || [];
  const currentMonth = monthKey();
  const categories = ["Shipping expense", "Packaging", "Software", "Advertising", "Inventory purchases"];
  const generated = categories.filter((category) => !stored.some((budget) => budget.month === currentMonth && budget.category === category)).map<Budget>((category) => {
    const amount = category === "Inventory purchases" ? 500 : category === "Advertising" ? 150 : 100;
    const actualAmount = sum(expenses.filter((expense) => expense.category === category && expense.date.startsWith(currentMonth)), (expense) => expense.amount);
    const remainingAmount = round(amount - actualAmount);
    return { id: deterministicUuid(`budget:${currentMonth}:${category.toLowerCase().replaceAll(" ", "_")}`), month: currentMonth, category, amount, actualAmount, remainingAmount, alertThreshold: 0.85, status: actualAmount > amount ? "overspent" : actualAmount >= amount * 0.85 ? "near_limit" : "on_track", createdAt: now() };
  });
  return [...stored, ...generated];
}

function normalizeTaxReserve(data: OperatingData, reconciliations: ReturnType<typeof reconcileOrder>[]): TaxReserveMovement[] {
  if (data.taxReserveMovements?.length) return data.taxReserveMovements;
  return reconciliations.filter((entry) => entry.contributionProfit > 0).map((entry) => ({ id: deterministicUuid(`tax:${entry.orderId}`), amount: round(entry.contributionProfit * 0.18), basisAmount: entry.contributionProfit, rate: 0.18, sourceType: "order", sourceId: entry.orderId, status: "reserved", createdAt: now(), notes: `18% reserve from contribution profit on ${entry.number}.` }));
}

function normalizeReinvestment(data: OperatingData): ReinvestmentAllocation[] {
  if (data.reinvestmentAllocations?.length) return data.reinvestmentAllocations;
  const time = now();
  return [
    ["inventory", 45], ["shipping_reserve", 10], ["marketing", 10], ["operating_reserve", 15], ["tax_reserve", 10], ["owner_distribution", 10],
  ].map(([target, percentage]) => ({ id: deterministicUuid(`allocation:${target}`), target: target as ReinvestmentAllocation["target"], percentage: Number(percentage), amount: 0, basis: "deployable_cash", createdAt: time }));
}

function normalizeForecasts(data: OperatingData, reconciliations: ReturnType<typeof reconcileOrder>[], payouts: Payout[], budgets: Budget[]): Forecast[] {
  if (data.forecasts?.length) return data.forecasts;
  const revenue = sum(reconciliations, (entry) => entry.netSale);
  const contributionProfit = sum(reconciliations, (entry) => entry.contributionProfit);
  const reorderCosts = sum(data.variants, (variant) => {
    const balance = data.balances.find((entry) => entry.variantId === variant.id);
    const available = balance ? Math.max(0, balance.onHand - balance.reserved - balance.damaged - balance.quarantined) : 0;
    return available <= variant.reorderPoint ? variant.reorderQuantity * variant.landedUnitCost : 0;
  });
  return [{ id: deterministicUuid(`forecast:${monthKey()}`), period: monthKey(), revenue: round(revenue * 1.15), contributionProfit: round(contributionProfit * 1.1), operatingProfit: round(contributionProfit - sum(budgets, (budget) => Math.max(0, budget.actualAmount))), cash: sum(data.transactions.filter((entry) => entry.status === "cleared"), (entry) => entry.amount) + sum(payouts, (entry) => entry.expectedAmount), inventoryPurchasing: reorderCosts, payouts: sum(payouts, (entry) => entry.expectedAmount), stockouts: data.balances.filter((balance) => balance.onHand - balance.reserved <= 0).length, reorderCosts, confidence: data.orders.length >= 10 ? 0.72 : 0.48, assumptions: ["Uses current order margin as baseline.", "Pending payouts are treated as confirmed only when expected amount is positive.", "Reorder costs use current reorder quantity and landed unit cost.", "Live marketplace and bank feeds can replace manual payout assumptions later."], createdAt: now() }];
}

function buildFinanceOverview(data: OperatingData, ledger: FinanceLedgerEntry[], reconciliations: ReturnType<typeof reconcileOrder>[], payouts: Payout[], budgets: Budget[], taxReserve: TaxReserveMovement[]) {
  const grossSales = sum(reconciliations, (entry) => entry.grossSale);
  const netSales = sum(reconciliations, (entry) => entry.netSale);
  const cogs = sum(reconciliations, (entry) => entry.cogs);
  const grossProfit = sum(reconciliations, (entry) => entry.grossProfit);
  const contributionProfit = sum(reconciliations, (entry) => entry.contributionProfit);
  const operatingExpenses = sum(ledger.filter((entry) => entry.amount < 0 && ["software", "advertising", "expense"].includes(entry.type)), (entry) => Math.abs(entry.amount));
  const operatingProfit = round(contributionProfit - operatingExpenses);
  const cash = sum(ledger.filter((entry) => entry.status === "cleared"), (entry) => entry.amount);
  const pendingPayouts = sum(payouts.filter((entry) => ["expected", "received"].includes(entry.status)), (entry) => entry.actualAmount ?? entry.expectedAmount);
  const committedPurchaseSpending = sum(data.purchaseOrders.filter((po) => ["draft", "ordered", "partial"].includes(po.status)), (po) => po.totalCost);
  const taxReserveAmount = sum(taxReserve.filter((entry) => entry.status === "reserved"), (entry) => entry.amount);
  const operatingBuffer = Math.max(250, round(sum(budgets, (budget) => budget.amount) * 0.25));
  const unpaidObligations = sum(ledger.filter((entry) => entry.status === "pending" && entry.amount < 0), (entry) => Math.abs(entry.amount));
  const deployableCash = round(cash + pendingPayouts - unpaidObligations - committedPurchaseSpending - taxReserveAmount - operatingBuffer);
  const deployableComponents: DeployableCashComponent[] = [
    { label: "Cash", amount: cash, sourceType: "transactions", sourceIds: ledger.filter((entry) => entry.status === "cleared").map((entry) => entry.id) },
    { label: "Confirmed pending payouts", amount: pendingPayouts, sourceType: "payouts", sourceIds: payouts.map((entry) => entry.id) },
    { label: "Unpaid obligations", amount: -unpaidObligations, sourceType: "transactions", sourceIds: ledger.filter((entry) => entry.status === "pending" && entry.amount < 0).map((entry) => entry.id) },
    { label: "Committed purchase orders", amount: -committedPurchaseSpending, sourceType: "purchase_orders", sourceIds: data.purchaseOrders.filter((po) => ["draft", "ordered", "partial"].includes(po.status)).map((po) => po.id) },
    { label: "Tax reserve", amount: -taxReserveAmount, sourceType: "tax_reserve", sourceIds: taxReserve.map((entry) => entry.id) },
    { label: "Minimum operating buffer", amount: -operatingBuffer, sourceType: "budgets", sourceIds: budgets.map((entry) => entry.id) },
  ];
  return { grossSales, netSales, cogs, grossProfit, contributionProfit, operatingExpenses, operatingProfit, margin: netSales ? round(contributionProfit / netSales * 100) : 0, cash, pendingPayouts, committedPurchaseSpending, taxReserve: taxReserveAmount, operatingBuffer, unpaidObligations, deployableCash, deployableComponents, inventoryValue: inventoryValue(data.balances, data.variants) };
}
