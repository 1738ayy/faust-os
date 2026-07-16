import type { Activity, DurableJob, InventoryPurchaseBatch, JournalEntry, JournalLine, LandedCostAllocationMethod, LandedCostComponent, OperatingData, OrderItemCostAllocation, TransactionalOutboxEvent } from "@/domain/business";

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export type WholesaleBatchItemInput = { variantId: string; quantity: number; unitCost: number; weightOz?: number; manualLandedCostUsd?: number; physicalSku?: string; locationId?: string };
export type LandedCostInput = { type: LandedCostComponent["type"]; description: string; amount: number; currency: "USD" | "RMB"; allocationMethod: LandedCostAllocationMethod };
export type ReceiveWholesaleBatchInput = { reference: string; supplierId?: string; purchaseOrderId?: string; currency: "USD" | "RMB"; rmbUsdRate?: number; receivedAt?: string; items: WholesaleBatchItemInput[]; landedCosts: LandedCostInput[]; idempotencyKey?: string };
export type AllocateFifoInput = { orderId: string; orderItemId: string; quantity?: number; idempotencyKey?: string };
export type ReceiveWholesaleReturnInput = { orderId: string; orderItemId: string; quantity: number; returnId: string; mode: "original_lot" | "returned_goods_lot"; idempotencyKey?: string };
export type SyncChannelRiskInput = { variantId: string; listingId: string; desiredQuantity: number; physicalSku: string; idempotencyKey?: string };
export type ProcessOutboxInput = { failEventId?: string; maxAttempts?: number };

export function ensureWholesaleCollections(data: OperatingData) {
  data.purchaseBatches ||= [];
  data.inventoryLots ||= [];
  data.landedCostComponents ||= [];
  data.exchangeRates ||= [];
  data.orderItemCostAllocations ||= [];
  data.journalEntries ||= [];
  data.journalLines ||= [];
  data.outboxEvents ||= [];
  data.durableJobs ||= [];
  data.deadLetters ||= [];
  data.channelSyncStates ||= [];
  data.inventoryRiskLocks ||= [];
  data.physicalSkuMappings ||= [];
}

function addActivity(data: OperatingData, action: string, entityType: string, entityId: string, detail: string) {
  data.activity.unshift({ id: id(), action, entityType, entityId, detail, createdAt: now() } satisfies Activity);
}

function addOutboxAndJob(data: OperatingData, topic: TransactionalOutboxEvent["topic"], aggregateType: string, aggregateId: string, payload: Record<string, unknown>, idempotencyKey?: string) {
  ensureWholesaleCollections(data);
  const existing = idempotencyKey ? data.outboxEvents!.find((event) => event.idempotencyKey === idempotencyKey && event.topic === topic) : undefined;
  if (existing) return existing;
  const event: TransactionalOutboxEvent = { id: id(), topic, aggregateType, aggregateId, payload, status: "pending", attempts: 0, idempotencyKey, createdAt: now() };
  const job: DurableJob = { id: id(), queue: topic.startsWith("channel.") ? "channel_sync" : topic.startsWith("finance.") ? "ledger_posting" : "inventory_risk", eventId: event.id, status: "queued", attempts: 0, maxAttempts: 3, payload, runAfter: now(), createdAt: now() };
  data.outboxEvents!.unshift(event);
  data.durableJobs!.unshift(job);
  return event;
}

function addJournal(data: OperatingData, input: { sourceType: JournalEntry["sourceType"]; sourceId: string; description: string; idempotencyKey?: string; lines: Omit<JournalLine, "id" | "journalEntryId" | "createdAt">[] }) {
  ensureWholesaleCollections(data);
  const existing = input.idempotencyKey ? data.journalEntries!.find((entry) => entry.idempotencyKey === input.idempotencyKey) : undefined;
  if (existing) return existing;
  const debit = round(input.lines.reduce((sum, line) => sum + line.debit, 0));
  const credit = round(input.lines.reduce((sum, line) => sum + line.credit, 0));
  if (debit !== credit) throw new Error(`Journal entry is not balanced: debit ${debit}, credit ${credit}.`);
  const entry: JournalEntry = { id: id(), entryNumber: `JE-${String(data.journalEntries!.length + 1).padStart(5, "0")}`, status: "posted", sourceType: input.sourceType, sourceId: input.sourceId, description: input.description, totalDebit: debit, totalCredit: credit, idempotencyKey: input.idempotencyKey, createdAt: now(), postedAt: now() };
  const lines = input.lines.map((line) => ({ id: id(), journalEntryId: entry.id, createdAt: now(), ...line }));
  data.journalEntries!.unshift(entry);
  data.journalLines!.unshift(...lines);
  addOutboxAndJob(data, "finance.journal.posted", "journal_entry", entry.id, { entryId: entry.id, totalDebit: debit, totalCredit: credit }, input.idempotencyKey ? `${input.idempotencyKey}:journal` : undefined);
  return entry;
}

export function assertBalancedJournals(data: OperatingData) {
  ensureWholesaleCollections(data);
  for (const entry of data.journalEntries!) {
    const lines = data.journalLines!.filter((line) => line.journalEntryId === entry.id);
    const debit = round(lines.reduce((sum, line) => sum + line.debit, 0));
    const credit = round(lines.reduce((sum, line) => sum + line.credit, 0));
    if (debit !== credit || debit !== entry.totalDebit || credit !== entry.totalCredit) throw new Error(`Unbalanced journal entry ${entry.entryNumber}.`);
  }
}

function exchangeRate(data: OperatingData, currency: "USD" | "RMB", explicitRate?: number) {
  ensureWholesaleCollections(data);
  if (currency === "USD") return { rate: 1, rateId: undefined };
  if (explicitRate && explicitRate > 0) {
    const rate = { id: id(), baseCurrency: "RMB" as const, quoteCurrency: "USD" as const, rate: explicitRate, effectiveAt: now(), source: "manual" as const, createdAt: now() };
    data.exchangeRates!.unshift(rate);
    return { rate: explicitRate, rateId: rate.id };
  }
  const latest = [...data.exchangeRates!].filter((entry) => entry.baseCurrency === "RMB" && entry.quoteCurrency === "USD").sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt))[0];
  if (!latest) throw new Error("An RMB/USD exchange rate is required before costing RMB purchases.");
  return { rate: latest.rate, rateId: latest.id };
}

export function allocateLandedCosts(items: WholesaleBatchItemInput[], landedCosts: LandedCostInput[], rate: number) {
  const productValues = items.map((item) => item.quantity * item.unitCost * rate);
  const weights = items.map((item) => (item.weightOz || 0) * item.quantity);
  const quantities = items.map((item) => item.quantity);
  const allocations = items.map(() => 0);
  landedCosts.forEach((component) => {
    const amountUsd = component.currency === "RMB" ? component.amount * rate : component.amount;
    const basis = component.allocationMethod === "by_weight" && weights.some(Boolean) ? weights : component.allocationMethod === "by_value" ? productValues : component.allocationMethod === "manual" && items.some((item) => item.manualLandedCostUsd) ? items.map((item) => item.manualLandedCostUsd || 0) : quantities;
    const totalBasis = basis.reduce((sum, value) => sum + value, 0);
    if (totalBasis <= 0) throw new Error(`Cannot allocate ${component.description}; allocation basis is zero.`);
    basis.forEach((value, index) => { allocations[index] += amountUsd * (value / totalBasis); });
  });
  return allocations.map(round);
}

export function receiveWholesalePurchaseBatch(data: OperatingData, input: ReceiveWholesaleBatchInput) {
  ensureWholesaleCollections(data);
  if (!input.items.length) throw new Error("A wholesale purchase batch needs at least one item.");
  if (input.items.some((item) => item.quantity <= 0 || item.unitCost < 0)) throw new Error("Wholesale batch quantities must be positive and costs cannot be negative.");
  const duplicate = input.idempotencyKey ? data.purchaseBatches!.find((batch) => batch.idempotencyKey === input.idempotencyKey) : undefined;
  if (duplicate) return data;
  const { rate, rateId } = exchangeRate(data, input.currency, input.rmbUsdRate);
  const receivedAt = input.receivedAt || now();
  const subtotalOriginal = round(input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0));
  const subtotalUsd = round(subtotalOriginal * rate);
  const allocations = allocateLandedCosts(input.items, input.landedCosts, rate);
  const landedCostUsd = round(allocations.reduce((sum, value) => sum + value, 0));
  const batch: InventoryPurchaseBatch = { id: id(), supplierId: input.supplierId, purchaseOrderId: input.purchaseOrderId, reference: input.reference, currency: input.currency, exchangeRateId: rateId, status: "costed", itemCount: input.items.reduce((sum, item) => sum + item.quantity, 0), subtotalOriginal, subtotalUsd, landedCostUsd, totalCostUsd: round(subtotalUsd + landedCostUsd), receivedAt, idempotencyKey: input.idempotencyKey, createdAt: now(), updatedAt: now() };
  data.purchaseBatches!.unshift(batch);
  input.landedCosts.forEach((component) => data.landedCostComponents!.unshift({ id: id(), batchId: batch.id, type: component.type, description: component.description, amountOriginal: component.amount, currency: component.currency, amountUsd: round(component.currency === "RMB" ? component.amount * rate : component.amount), allocationMethod: component.allocationMethod, linkedObjectType: input.purchaseOrderId ? "purchase_order" : "manual", linkedObjectId: input.purchaseOrderId, createdAt: now() }));
  input.items.forEach((item, index) => {
    const variant = data.variants.find((entry) => entry.id === item.variantId);
    if (!variant) throw new Error("Wholesale batch item references a missing variant.");
    const productCostUsd = item.unitCost * rate;
    const unitLandedCostUsd = round(productCostUsd + allocations[index] / item.quantity);
    data.inventoryLots!.unshift({ id: id(), batchId: batch.id, variantId: item.variantId, sku: variant.sku, physicalSku: item.physicalSku || variant.sku, quantityReceived: item.quantity, quantityRemaining: item.quantity, quantityReserved: 0, unitProductCostUsd: round(productCostUsd), unitLandedCostUsd, totalLandedCostUsd: round(unitLandedCostUsd * item.quantity), currency: input.currency, originalUnitCost: item.unitCost, exchangeRate: rate, locationId: item.locationId, condition: "available", sourceType: "purchase_batch", sourceId: batch.id, receivedAt, createdAt: now(), updatedAt: now() });
  });
  addJournal(data, { sourceType: "purchase_batch", sourceId: batch.id, description: `Wholesale purchase batch ${batch.reference}`, idempotencyKey: input.idempotencyKey, lines: [{ accountCode: "1400", accountName: "Inventory asset", debit: batch.totalCostUsd, credit: 0, sourceType: "purchase_batch", sourceId: batch.id }, { accountCode: "2000", accountName: "Accounts payable", debit: 0, credit: batch.totalCostUsd, sourceType: "purchase_batch", sourceId: batch.id }] });
  addOutboxAndJob(data, "inventory.lot.received", "purchase_batch", batch.id, { batchId: batch.id, lotCount: input.items.length, totalCostUsd: batch.totalCostUsd }, input.idempotencyKey);
  addActivity(data, "Wholesale batch received", "purchase_batch", batch.id, `${batch.reference} created ${input.items.length} inventory lot(s).`);
  return data;
}

export function allocateOrderItemFifo(data: OperatingData, input: AllocateFifoInput) {
  ensureWholesaleCollections(data);
  const existing = input.idempotencyKey ? data.orderItemCostAllocations!.filter((entry) => entry.idempotencyKey === input.idempotencyKey) : [];
  if (existing.length) return data;
  const order = data.orders.find((entry) => entry.id === input.orderId);
  const item = order?.items.find((entry) => entry.id === input.orderItemId);
  if (!order || !item) throw new Error("Order item not found for FIFO allocation.");
  const quantity = input.quantity ?? item.quantity;
  let remaining = quantity;
  const lots = data.inventoryLots!.filter((lot) => lot.variantId === item.variantId && lot.condition === "available" && lot.quantityRemaining - lot.quantityReserved > 0).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  const created: OrderItemCostAllocation[] = [];
  for (const lot of lots) {
    if (remaining <= 0) break;
    const available = lot.quantityRemaining - lot.quantityReserved;
    const take = Math.min(available, remaining);
    lot.quantityRemaining -= take;
    lot.updatedAt = now();
    remaining -= take;
    const allocation = { id: id(), orderId: order.id, orderItemId: item.id, variantId: item.variantId, lotId: lot.id, quantity: take, unitCostUsd: lot.unitLandedCostUsd, totalCostUsd: round(take * lot.unitLandedCostUsd), method: "fifo" as const, idempotencyKey: input.idempotencyKey, createdAt: now() };
    data.orderItemCostAllocations!.unshift(allocation);
    created.push(allocation);
  }
  if (remaining > 0) throw new Error("Insufficient FIFO lot quantity for order item.");
  const totalCost = round(created.reduce((sum, allocation) => sum + allocation.totalCostUsd, 0));
  item.unitCost = round(totalCost / quantity);
  item.profitContribution = round(item.unitSellingPrice * item.quantity - item.discountAllocation - totalCost - (item.marketplaceFeeAllocation || 0) - (item.paymentFeeAllocation || 0));
  addJournal(data, { sourceType: "order_item_allocation", sourceId: item.id, description: `FIFO COGS allocation for ${order.number}`, idempotencyKey: input.idempotencyKey, lines: [{ accountCode: "5000", accountName: "Cost of goods sold", debit: totalCost, credit: 0, sourceType: "order_item", sourceId: item.id }, { accountCode: "1400", accountName: "Inventory asset", debit: 0, credit: totalCost, sourceType: "order_item", sourceId: item.id }] });
  addOutboxAndJob(data, "inventory.fifo.allocated", "order_item", item.id, { orderId: order.id, orderItemId: item.id, totalCost }, input.idempotencyKey);
  addActivity(data, "FIFO lot allocated", "order_item", item.id, `${quantity} unit(s) allocated from ${created.length} lot(s).`);
  return data;
}

export function receiveWholesaleReturn(data: OperatingData, input: ReceiveWholesaleReturnInput) {
  ensureWholesaleCollections(data);
  const duplicate = input.idempotencyKey ? data.orderItemCostAllocations!.some((allocation) => allocation.idempotencyKey === input.idempotencyKey && allocation.returnId === input.returnId) : false;
  if (duplicate) return data;
  const originalAllocations = data.orderItemCostAllocations!.filter((allocation) => allocation.orderItemId === input.orderItemId);
  if (input.mode === "original_lot") {
    let remaining = input.quantity;
    for (const allocation of originalAllocations) {
      if (remaining <= 0) break;
      const lot = data.inventoryLots!.find((entry) => entry.id === allocation.lotId);
      if (!lot) continue;
      const putBack = Math.min(allocation.quantity, remaining);
      lot.quantityRemaining += putBack;
      lot.updatedAt = now();
      remaining -= putBack;
    }
    if (remaining > 0) throw new Error("Return quantity exceeds original FIFO allocation.");
  } else {
    const order = data.orders.find((entry) => entry.id === input.orderId);
    const item = order?.items.find((entry) => entry.id === input.orderItemId);
    if (!item) throw new Error("Order item not found for returned-goods lot.");
    const unitCost = originalAllocations[0]?.unitCostUsd || item.unitCost;
    const variant = data.variants.find((entry) => entry.id === item.variantId);
    data.inventoryLots!.unshift({ id: id(), variantId: item.variantId, sku: variant?.sku || item.variantId, physicalSku: variant?.sku, quantityReceived: input.quantity, quantityRemaining: input.quantity, quantityReserved: 0, unitProductCostUsd: unitCost, unitLandedCostUsd: unitCost, totalLandedCostUsd: round(unitCost * input.quantity), currency: "USD", originalUnitCost: unitCost, exchangeRate: 1, condition: "returned_goods", sourceType: "return", sourceId: input.returnId, receivedAt: now(), createdAt: now() });
  }
  const value = round((originalAllocations[0]?.unitCostUsd || 0) * input.quantity);
  if (value > 0) addJournal(data, { sourceType: "return", sourceId: input.returnId, description: "Returned inventory received", idempotencyKey: input.idempotencyKey, lines: [{ accountCode: "1400", accountName: "Inventory asset", debit: value, credit: 0, sourceType: "return", sourceId: input.returnId }, { accountCode: "5000", accountName: "Cost of goods sold", debit: 0, credit: value, sourceType: "return", sourceId: input.returnId }] });
  addOutboxAndJob(data, "inventory.return.received", "return", input.returnId, { orderId: input.orderId, orderItemId: input.orderItemId, quantity: input.quantity, mode: input.mode }, input.idempotencyKey);
  addActivity(data, "Wholesale return received", "return", input.returnId, `${input.quantity} unit(s) restored via ${input.mode}.`);
  return data;
}

export function syncChannelInventoryRisk(data: OperatingData, input: SyncChannelRiskInput) {
  ensureWholesaleCollections(data);
  const listing = data.listings.find((entry) => entry.id === input.listingId);
  if (!listing) throw new Error("Listing not found for channel sync.");
  let mapping = data.physicalSkuMappings!.find((entry) => entry.variantId === input.variantId && entry.channelListingId === listing.id);
  if (!mapping) {
    mapping = { id: id(), variantId: input.variantId, physicalSku: input.physicalSku, channelListingId: listing.id, channel: listing.marketplace, externalSku: input.physicalSku, externalListingId: listing.marketplaceUrl || listing.id, status: "active", confidence: 0.95, createdAt: now() };
    data.physicalSkuMappings!.unshift(mapping);
  }
  const usable = data.inventoryLots!.filter((lot) => lot.variantId === input.variantId && lot.condition === "available").reduce((sum, lot) => sum + lot.quantityRemaining - lot.quantityReserved, 0);
  const risk = !mapping.physicalSku ? "unmapped" : usable < input.desiredQuantity ? "oversell" : "none";
  const state = { id: data.channelSyncStates!.find((entry) => entry.listingId === input.listingId)?.id || id(), channel: listing.marketplace, listingId: input.listingId, variantId: input.variantId, physicalSku: input.physicalSku, desiredQuantity: input.desiredQuantity, lastSyncedQuantity: risk === "none" ? input.desiredQuantity : undefined, status: risk === "none" ? "pending" as const : "blocked" as const, risk: risk as "none" | "oversell" | "stale" | "unmapped", nextSyncAt: now(), updatedAt: now() };
  data.channelSyncStates = [state, ...data.channelSyncStates!.filter((entry) => entry.id !== state.id)];
  if (risk !== "none" && !data.inventoryRiskLocks!.some((lock) => lock.status === "active" && lock.listingId === input.listingId && lock.reason === "oversell_risk")) data.inventoryRiskLocks!.unshift({ id: id(), variantId: input.variantId, listingId: input.listingId, channel: listing.marketplace, reason: risk === "unmapped" ? "unmapped_sku" : "oversell_risk", status: "active", lockedQuantity: Math.max(input.desiredQuantity - usable, 0), createdAt: now(), notes: `Usable ${usable}, desired ${input.desiredQuantity}.` });
  addOutboxAndJob(data, "channel.inventory.sync_requested", "listing", input.listingId, { listingId: input.listingId, variantId: input.variantId, desiredQuantity: input.desiredQuantity, risk }, input.idempotencyKey);
  addActivity(data, "Channel inventory sync assessed", "listing", input.listingId, risk === "none" ? "Sync can proceed." : `Risk lock created: ${risk}.`);
  return data;
}

export function processWholesaleOutbox(data: OperatingData, input: ProcessOutboxInput = {}) {
  ensureWholesaleCollections(data);
  const maxAttempts = input.maxAttempts || 3;
  for (const event of data.outboxEvents!.filter((entry) => ["pending", "failed"].includes(entry.status))) {
    event.attempts += 1;
    event.updatedAt = now();
    if (input.failEventId === event.id || event.attempts >= maxAttempts) {
      event.status = "dead_lettered";
      const job = data.durableJobs!.find((entry) => entry.eventId === event.id);
      if (job) { job.status = "dead_lettered"; job.attempts = event.attempts; job.lastError = "Exceeded retry policy."; job.updatedAt = now(); }
      data.deadLetters!.unshift({ id: id(), sourceType: "outbox_event", sourceId: event.id, reason: "Exceeded retry policy.", payload: event.payload, createdAt: now() });
    } else {
      event.status = "published";
      const job = data.durableJobs!.find((entry) => entry.eventId === event.id);
      if (job) { job.status = "succeeded"; job.attempts = event.attempts; job.updatedAt = now(); }
    }
  }
  addActivity(data, "Wholesale outbox processed", "outbox", "wholesale", `${data.outboxEvents!.filter((entry) => entry.status === "published").length} published, ${data.deadLetters!.length} dead-lettered.`);
  return data;
}

export function wholesaleCoreSummary(data: OperatingData) {
  ensureWholesaleCollections(data);
  assertBalancedJournals(data);
  return {
    purchaseBatches: data.purchaseBatches!.length,
    inventoryLots: data.inventoryLots!.length,
    fifoAllocations: data.orderItemCostAllocations!.length,
    journalEntries: data.journalEntries!.length,
    outboxPending: data.outboxEvents!.filter((event) => event.status === "pending").length,
    deadLetters: data.deadLetters!.length,
    activeRiskLocks: data.inventoryRiskLocks!.filter((lock) => lock.status === "active").length,
    mappedSkus: data.physicalSkuMappings!.filter((mapping) => mapping.status === "active").length,
  };
}
