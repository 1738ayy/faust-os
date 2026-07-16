import type { Marketplace, OperatingData, Order } from "@/domain/business";
import { availableUnits, inventoryValue, orderProfit, reorderSuggestion } from "./business-calculations";
import { buildFinanceModel } from "./finance";

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const sum = <T>(items: T[], selector: (item: T) => number) => round(items.reduce((total, item) => total + selector(item), 0));
const daysBetween = (from?: string, to?: string) => from && to ? Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000)) : 0;
const hoursBetween = (from?: string, to?: string) => from && to ? Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 3600000 * 10) / 10) : 0;
const marketplaces: Exclude<Marketplace, "Manual">[] = ["Depop", "eBay", "Etsy", "Mercari", "Poshmark"];

export type AnalyticsFilters = { from?: string; to?: string; marketplace?: string; supplierId?: string; sku?: string };
export type AnalyticsModel = ReturnType<typeof buildAnalyticsModel>;

function inDateRange(date: string | undefined, filters: AnalyticsFilters) {
  if (!date) return true;
  const timestamp = new Date(date).getTime();
  if (filters.from && timestamp < new Date(filters.from).getTime()) return false;
  if (filters.to && timestamp > new Date(filters.to).getTime() + 86399999) return false;
  return true;
}

function orderMatches(order: Order, data: OperatingData, filters: AnalyticsFilters) {
  if (!inDateRange(order.orderedAt, filters)) return false;
  if (filters.marketplace && filters.marketplace !== "all" && order.marketplace !== filters.marketplace) return false;
  if (filters.sku && filters.sku !== "all") {
    const variant = data.variants.find((item) => item.sku === filters.sku);
    if (!variant || !order.items.some((item) => item.variantId === variant.id)) return false;
  }
  if (filters.supplierId && filters.supplierId !== "all") {
    const productIds = data.products.filter((product) => product.supplierId === filters.supplierId).map((product) => product.id);
    const variantIds = data.variants.filter((variant) => productIds.includes(variant.productId)).map((variant) => variant.id);
    if (!order.items.some((item) => variantIds.includes(item.variantId))) return false;
  }
  return true;
}

function filteredData(data: OperatingData, filters: AnalyticsFilters) {
  const orders = data.orders.filter((order) => orderMatches(order, data, filters));
  const variantIds = new Set(orders.flatMap((order) => order.items.map((item) => item.variantId)));
  const variants = filters.sku && filters.sku !== "all" ? data.variants.filter((variant) => variant.sku === filters.sku) : data.variants.filter((variant) => !variantIds.size || variantIds.has(variant.id));
  return { orders, variants };
}

function average(values: number[]) {
  return values.length ? round(values.reduce((total, value) => total + value, 0) / values.length) : 0;
}

function fulfillmentHours(order: Order, status: string) {
  const event = (order.statusEvents || []).find((entry) => entry.toStatus === status);
  return hoursBetween(order.orderedAt, event?.createdAt || (order.status === status ? order.orderedAt : undefined));
}

export function buildAnalyticsModel(data: OperatingData, filters: AnalyticsFilters = {}) {
  const scoped = filteredData(data, filters);
  const scopedData = { ...data, orders: scoped.orders };
  const finance = buildFinanceModel(scopedData);
  const reconciliations = finance.reconciliations;
  const unitsSold = sum(scoped.orders, (order) => sum(order.items, (item) => item.quantity - (item.cancelledQuantity || 0)));
  const executive = {
    revenue: finance.overview.grossSales,
    netRevenue: finance.overview.netSales,
    grossProfit: finance.overview.grossProfit,
    contributionMargin: finance.overview.margin,
    operatingProfit: finance.overview.operatingProfit,
    orders: scoped.orders.length,
    unitsSold,
    averageOrderValue: scoped.orders.length ? round(finance.overview.netSales / scoped.orders.length) : 0,
    deployableCash: finance.overview.deployableCash,
    inventoryValue: inventoryValue(data.balances, data.variants),
    pendingPayouts: finance.overview.pendingPayouts,
    purchaseCommitments: finance.overview.committedPurchaseSpending,
    taxReserve: finance.overview.taxReserve,
    cashRunwayDays: finance.overview.operatingExpenses > 0 ? Math.floor(Math.max(0, finance.overview.cash) / Math.max(1, finance.overview.operatingExpenses / 30)) : 999,
    sourceRecordCount: data.orders.length + data.transactions.length + data.balances.length + data.purchaseOrders.length + (data.fulfillmentShipments || []).length,
  };

  const productAnalytics = data.variants.map((variant) => {
    const orders = scoped.orders.filter((order) => order.items.some((item) => item.variantId === variant.id));
    const lines = orders.flatMap((order) => order.items.filter((item) => item.variantId === variant.id).map((item) => ({ order, item })));
    const revenue = sum(lines, ({ item }) => item.unitSellingPrice * item.quantity - item.discountAllocation);
    const cogs = sum(lines, ({ item }) => item.unitCost * item.quantity);
    const fees = sum(lines, ({ item }) => (item.feeAllocation || 0) + (item.marketplaceFeeAllocation || 0) + (item.paymentFeeAllocation || 0));
    const profit = round(revenue - cogs - fees);
    const balance = data.balances.find((item) => item.variantId === variant.id);
    const lots = (data.inventoryLots || []).filter((lot) => lot.variantId === variant.id);
    const soldUnits = sum(lines, ({ item }) => item.quantity - (item.cancelledQuantity || 0));
    const receivedUnits = sum(lots, (lot) => lot.quantityReceived) || (balance?.onHand || 0) + soldUnits;
    const firstReceipt = lots.map((lot) => lot.receivedAt).sort()[0];
    const firstSale = orders.map((order) => order.orderedAt).sort()[0];
    const available = balance ? availableUnits(balance) : 0;
    return {
      variantId: variant.id,
      sku: variant.sku,
      title: variant.title,
      revenue,
      profit,
      margin: revenue ? round(profit / revenue * 100) : 0,
      sellThrough: receivedUnits ? round(soldUnits / receivedUnits * 100) : 0,
      daysToSell: daysBetween(firstReceipt, firstSale),
      inventoryTurnover: balance?.onHand ? round(soldUnits / Math.max(1, balance.onHand)) : soldUnits,
      fifoCostHistory: lots.map((lot) => ({ lotId: lot.id, receivedAt: lot.receivedAt, unitCostUsd: lot.unitLandedCostUsd, quantityRemaining: lot.quantityRemaining })),
      lotProfitability: lots.map((lot) => ({ lotId: lot.id, unitLandedCostUsd: lot.unitLandedCostUsd, realizedRevenue: revenue, remainingValue: round(lot.quantityRemaining * lot.unitLandedCostUsd) })),
      deadStock: soldUnits === 0 && available > 0,
      overstock: available > variant.reorderQuantity * 2,
      stockoutRisk: available + (balance?.incoming || 0) <= variant.reorderPoint,
      reorderQuantity: reorderSuggestion(balance, variant),
      sourceHref: `/inventory?sku=${encodeURIComponent(variant.sku)}`,
    };
  });

  const channelAnalytics = marketplaces.map((marketplace) => {
    const orders = scoped.orders.filter((order) => order.marketplace === marketplace);
    const channelData = { ...data, orders };
    const profits = orders.map((order) => orderProfit(order, data.variants));
    const revenue = sum(profits, (profit) => profit.netSales);
    const profit = sum(profits, (entry) => entry.contributionProfit);
    const fees = sum(profits, (entry) => entry.marketplaceFees + entry.paymentFees);
    const returns = sum(orders, (order) => (order.returns || []).length);
    const refunds = sum(orders, (order) => (order.refunds || []).reduce((total, refund) => total + refund.amount, 0));
    const drafts = (data.channelListingDrafts || []).filter((draft) => draft.marketplace === marketplace);
    const failedJobs = (data.listingSyncJobs || []).filter((job) => job.marketplace === marketplace && ["failed", "dead_lettered", "manual_required"].includes(job.status)).length;
    const fulfillment = orders.map((order) => fulfillmentHours(order, "shipped")).filter(Boolean);
    return {
      marketplace,
      revenue,
      profit,
      fees,
      margin: revenue ? round(profit / revenue * 100) : 0,
      returns,
      refundRate: revenue ? round(refunds / revenue * 100) : 0,
      sellThrough: sellThroughForOrders(orders, channelData),
      fulfillmentHours: average(fulfillment),
      syncReliability: drafts.length ? round((drafts.length - failedJobs) / drafts.length * 100) : 100,
      sourceHref: `/marketplace/${marketplace.toLowerCase()}`,
    };
  });

  const supplierAnalytics = data.suppliers.filter((supplier) => !filters.supplierId || filters.supplierId === "all" || supplier.id === filters.supplierId).map((supplier) => {
    const scorecard = (data.supplierScorecards || []).find((item) => item.supplierId === supplier.id);
    const purchaseOrders = data.purchaseOrders.filter((po) => po.supplierId === supplier.id);
    const payments = (data.purchasePayments || []).filter((payment) => payment.supplierId === supplier.id);
    const claims = (data.supplierClaims || []).filter((claim) => claim.supplierId === supplier.id);
    const priceHistory = (data.supplierPriceHistory || []).filter((price) => price.supplierId === supplier.id);
    const supplierProductIds = data.products.filter((product) => product.supplierId === supplier.id).map((product) => product.id);
    const supplierVariantIds = data.variants.filter((variant) => supplierProductIds.includes(variant.productId)).map((variant) => variant.id);
    const marginContribution = sum(reconciliations, (order) => sum(order.lineLevel.filter((line) => supplierVariantIds.some((id) => data.orders.find((source) => source.id === order.orderId)?.items.some((item) => item.id === line.itemId && item.variantId === id))), (line) => line.contributionProfit));
    const averageUnitCost = average(priceHistory.map((price) => price.unitCostUsd));
    return {
      supplierId: supplier.id,
      name: supplier.name,
      spend: sum(payments, (payment) => payment.amountUsd) || sum(purchaseOrders, (po) => po.totalCost),
      leadTime: scorecard?.averageLeadDays || supplier.leadDays || 0,
      defectRate: scorecard?.defectRate || 0,
      claimRate: purchaseOrders.length ? round(claims.length / purchaseOrders.length * 100) : 0,
      onTimeDelivery: scorecard ? round(scorecard.onTimeRate * 100) : 100,
      landedCostTrend: priceHistory.map((price) => ({ capturedAt: price.capturedAt, unitCostUsd: price.unitCostUsd })),
      averageUnitCost,
      supplierScore: scorecard ? Math.round((scorecard.qualityScore + scorecard.leadTimeScore + scorecard.communicationScore + scorecard.priceScore) / 4) : 0,
      marginContribution,
      sourceHref: `/suppliers?supplier=${supplier.id}`,
    };
  });

  const purchasingAnalytics = {
    openPurchaseOrders: data.purchaseOrders.filter((po) => ["draft", "ordered", "partial", "issue"].includes(po.status)).length,
    expectedArrivals: data.purchaseOrders.filter((po) => po.expectedAt && ["ordered", "partial"].includes(po.status)).map((po) => ({ id: po.id, reference: po.reference, expectedAt: po.expectedAt!, totalCost: po.totalCost })),
    receivingAccuracy: receivingAccuracy(data),
    freightCosts: sum(data.freightConsolidations || [], (entry) => entry.domesticFreightUsd + entry.internationalFreightUsd),
    dutiesAndCustoms: sum(data.freightConsolidations || [], (entry) => entry.dutiesUsd + entry.customsUsd),
    rmbUsdImpact: sum(data.supplierPriceHistory || [], (entry) => entry.unitCostOriginal * entry.exchangeRate - entry.unitCostUsd),
    purchaseCycleDays: average(data.purchaseOrders.map((po) => daysBetween(po.orderedAt, (data.receivingSessions || []).find((session) => session.purchaseOrderId === po.id)?.receivedAt)).filter(Boolean)),
  };

  const inventoryAnalytics = {
    carryingValue: inventoryValue(data.balances, data.variants),
    lowStock: productAnalytics.filter((item) => item.stockoutRisk).length,
    deadStock: productAnalytics.filter((item) => item.deadStock).length,
    incomingInventory: sum(data.balances, (balance) => balance.incoming || 0),
    lotAging: (data.inventoryLots || []).map((lot) => ({ lotId: lot.id, sku: lot.sku, ageDays: daysBetween(lot.receivedAt, new Date().toISOString()), remainingValue: round(lot.quantityRemaining * lot.unitLandedCostUsd) })),
    capitalTiedUp: sum(data.inventoryLots || [], (lot) => lot.quantityRemaining * lot.unitLandedCostUsd) || inventoryValue(data.balances, data.variants),
    safetyStock: sum(data.variants, (variant) => Math.ceil((variant.reorderQuantity || 1) / 2)),
    reorderPointUnits: sum(data.variants, (variant) => variant.reorderPoint),
  };

  const fulfillmentAnalytics = buildFulfillmentAnalytics(data, scoped.orders);
  const financeAnalytics = buildFinanceAnalytics(finance, data);
  const customerAnalytics = buildCustomerAnalytics(data, scoped.orders);
  const geographicAnalytics = buildGeographicAnalytics(data, scoped.orders);
  const reports = savedReports();
  const csvRows = [
    ["family", "metric", "value", "source"],
    ["executive", "revenue", executive.revenue, "finance.reconciliations"],
    ["executive", "deployable_cash", executive.deployableCash, "finance.overview"],
    ...productAnalytics.map((item) => ["product", `${item.sku} profit`, item.profit, item.sourceHref]),
    ...channelAnalytics.map((item) => ["channel", `${item.marketplace} revenue`, item.revenue, item.sourceHref]),
    ...supplierAnalytics.map((item) => ["supplier", `${item.name} score`, item.supplierScore, item.sourceHref]),
  ];

  return { filters, executive, products: productAnalytics, channels: channelAnalytics, suppliers: supplierAnalytics, purchasing: purchasingAnalytics, inventory: inventoryAnalytics, fulfillment: fulfillmentAnalytics, finance: financeAnalytics, customers: customerAnalytics, geography: geographicAnalytics, reports, csvRows };
}

function sellThroughForOrders(orders: Order[], data: OperatingData) {
  const sold = sum(orders, (order) => sum(order.items, (item) => item.quantity - (item.cancelledQuantity || 0)));
  const variantIds = new Set(orders.flatMap((order) => order.items.map((item) => item.variantId)));
  const received = sum(data.inventoryLots || [], (lot) => variantIds.has(lot.variantId) ? lot.quantityReceived : 0);
  return received ? round(sold / received * 100) : sold ? 100 : 0;
}

function receivingAccuracy(data: OperatingData) {
  const rows = (data.receivingSessions || []).flatMap((session) => session.rows);
  const expected = sum(rows, (row) => row.expectedQuantity);
  const issues = sum(rows, (row) => row.shortageQuantity + row.overageQuantity + row.damagedQuantity);
  return expected ? round((expected - issues) / expected * 100) : 100;
}

function buildFulfillmentAnalytics(data: OperatingData, orders: Order[]) {
  const shipments = data.fulfillmentShipments || [];
  const shipped = orders.filter((order) => ["shipped", "in_transit", "delivered", "closed"].includes(order.status));
  const late = orders.filter((order) => order.shipBy && new Date(order.shipBy) < new Date() && !["shipped", "in_transit", "delivered", "closed", "cancelled"].includes(order.status));
  return {
    pickHours: average(shipments.map((shipment) => hoursBetween(shipment.timestamps?.picking, shipment.timestamps?.ready_to_pack)).filter(Boolean)),
    packHours: average(shipments.map((shipment) => hoursBetween(shipment.timestamps?.packing, shipment.timestamps?.packed)).filter(Boolean)),
    shipHours: average(orders.map((order) => fulfillmentHours(order, "shipped")).filter(Boolean)),
    sameDayShippingRate: shipped.length ? round(shipped.filter((order) => fulfillmentHours(order, "shipped") <= 24).length / shipped.length * 100) : 0,
    lateShipmentRate: orders.length ? round(late.length / orders.length * 100) : 0,
    exceptionRate: shipments.length ? round((data.fulfillmentExceptions || []).length / shipments.length * 100) : 0,
    carrierPerformance: [...new Set(shipments.map((shipment) => shipment.carrier || "manual"))].map((carrier) => ({ carrier, shipments: shipments.filter((shipment) => (shipment.carrier || "manual") === carrier).length, delivered: shipments.filter((shipment) => (shipment.carrier || "manual") === carrier && shipment.status === "delivered").length })),
    shippingCostPerOrder: orders.length ? round(sum(orders, (order) => order.shippingCost) / orders.length) : 0,
  };
}

function buildFinanceAnalytics(finance: ReturnType<typeof buildFinanceModel>, data: OperatingData) {
  const byMonth = new Map<string, number>();
  for (const entry of finance.ledger) byMonth.set(entry.occurredAt.slice(0, 7), round((byMonth.get(entry.occurredAt.slice(0, 7)) || 0) + entry.amount));
  return {
    monthlyProfitAndLoss: [...byMonth.entries()].map(([month, amount]) => ({ month, amount })),
    cashFlow: finance.overview.cash,
    marginTrend: finance.reconciliations.map((entry) => ({ orderId: entry.orderId, number: entry.number, margin: entry.margin })),
    expenseTrend: finance.expenses.map((expense) => ({ date: expense.date, category: expense.category, amount: expense.amount })),
    budgetVariance: finance.budgets.map((budget) => ({ category: budget.category, variance: round(budget.amount - budget.actualAmount), status: budget.status })),
    forecastAccuracy: data.forecasts?.length ? average(data.forecasts.map((forecast) => forecast.confidence * 100)) : finance.forecasts[0]?.confidence ? round(finance.forecasts[0].confidence * 100) : 0,
    payoutDiscrepancies: finance.payoutReconciliations.filter((entry) => entry.discrepancyAmount !== 0).length,
    taxReserveTrend: finance.taxReserve.map((entry) => ({ date: entry.createdAt, amount: entry.amount, status: entry.status })),
  };
}

function buildCustomerAnalytics(data: OperatingData, orders: Order[]) {
  const byCustomer = data.customers.map((customer) => {
    const customerOrders = orders.filter((order) => order.customerId === customer.id);
    const profit = sum(customerOrders, (order) => orderProfit(order, data.variants).contributionProfit);
    const refunds = customerOrders.filter((order) => (order.refunds || []).length).length;
    const returns = customerOrders.filter((order) => (order.returns || []).length).length;
    return { customerId: customer.id, name: customer.name, orders: customerOrders.length, lifetimeRevenue: sum(customerOrders, (order) => orderProfit(order, data.variants).netSales), lifetimeProfit: profit, refundRate: customerOrders.length ? round(refunds / customerOrders.length * 100) : 0, returnRate: customerOrders.length ? round(returns / customerOrders.length * 100) : 0, marketplaceOrigin: customerOrders[0]?.marketplace || "Unknown" };
  });
  const repeatCustomers = byCustomer.filter((customer) => customer.orders > 1).length;
  return { repeatPurchaseRate: byCustomer.length ? round(repeatCustomers / byCustomer.length * 100) : 0, customers: byCustomer };
}

function buildGeographicAnalytics(_data: OperatingData, orders: Order[]) {
  const states = [...new Set(orders.map((order) => order.shippingAddress?.region || "Unknown"))];
  return states.map((state) => {
    const stateOrders = orders.filter((order) => (order.shippingAddress?.region || "Unknown") === state);
    return { state, revenue: sum(stateOrders, (order) => orderProfit(order, []).netSales), orders: stateOrders.length, shippingCost: sum(stateOrders, (order) => order.shippingCost), returnRate: stateOrders.length ? round(stateOrders.filter((order) => (order.returns || []).length).length / stateOrders.length * 100) : 0 };
  });
}

function savedReports() {
  return [
    { id: "executive", name: "Executive decision brief", sections: ["Executive Dashboard", "Finance Analytics", "Purchasing Analytics"] },
    { id: "sku-profitability", name: "SKU profitability and lot performance", sections: ["Product Analytics", "Inventory Analytics"] },
    { id: "channel-health", name: "Marketplace channel health", sections: ["Channel Analytics", "Fulfillment Analytics"] },
    { id: "supplier-scorecard", name: "Supplier purchasing scorecard", sections: ["Supplier Analytics", "Purchasing Analytics"] },
    { id: "cash-risk", name: "Cash, inventory, and reorder risk", sections: ["Finance Analytics", "Inventory Analytics", "Product Analytics"] },
  ];
}

export function analyticsCsv(model: AnalyticsModel) {
  return model.csvRows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
}
