import type { OperatingData, PurchaseApproval, PurchaseOrder, PurchasePayment, ReceivingSession, SupplierClaim, SupplierContact, SupplierScorecard } from "@/domain/business";
import { availableUnits } from "./business-calculations";
import { activeVariants, isActiveVariant } from "./product-state";
import { receiveWholesalePurchaseBatch } from "./wholesale-core";

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export type Create1688PurchaseInput = { supplierId: string; reference: string; currency: "RMB" | "USD"; exchangeRate: number; items: { variantId: string; expectedQuantity: number; unitCost: number }[]; domesticFreight?: number; internationalFreight?: number; duties?: number; customs?: number; idempotencyKey?: string };
export type PaymentInput = { purchaseOrderId: string; type: PurchasePayment["type"]; currency: "RMB" | "USD"; amountOriginal: number; exchangeRate: number; idempotencyKey?: string };
export type ReceivePurchaseInput = { purchaseOrderId: string; parcelId?: string; rows: { purchaseOrderItemId: string; receivedQuantity: number; damagedQuantity?: number; overageQuantity?: number; notes?: string }[]; idempotencyKey?: string };

export function ensurePurchasingCollections(data: OperatingData) {
  data.supplierContacts ||= [];
  data.supplierCommunications ||= [];
  data.supplierScorecards ||= [];
  data.purchaseApprovals ||= [];
  data.purchasePayments ||= [];
  data.freightConsolidations ||= [];
  data.receivingSessions ||= [];
  data.supplierClaims ||= [];
  data.supplierPriceHistory ||= [];
  data.reorderRecommendations ||= [];
  data.purchaseBatches ||= [];
  data.inventoryLots ||= [];
  data.landedCostComponents ||= [];
  data.exchangeRates ||= [];
}

function activity(data: OperatingData, action: string, entityType: string, entityId: string, detail: string) {
  data.activity.unshift({ id: id(), action, entityType, entityId, detail, createdAt: now() });
}

export function seedSupplierOperations(data: OperatingData) {
  ensurePurchasingCollections(data);
  for (const supplier of data.suppliers) {
    if (!data.supplierContacts!.some((entry) => entry.supplierId === supplier.id)) {
      const contact: SupplierContact = { id: id(), supplierId: supplier.id, name: supplier.contact || "1688 sales rep", role: "Sales", channel: "1688", handle: supplier.email || supplier.name, preferred: true, createdAt: now() };
      data.supplierContacts!.push(contact);
      data.supplierCommunications!.push({ id: id(), supplierId: supplier.id, contactId: contact.id, channel: contact.channel, direction: "internal_note", subject: "Supplier initialized", body: "Default 1688 communication thread created for purchasing operations.", occurredAt: now(), createdAt: now() });
    }
  }
  refreshSupplierScorecards(data);
}

export function refreshSupplierScorecards(data: OperatingData) {
  ensurePurchasingCollections(data);
  data.supplierScorecards = data.suppliers.map<SupplierScorecard>((supplier) => {
    const pos = data.purchaseOrders.filter((po) => po.supplierId === supplier.id);
    const payments = data.purchasePayments!.filter((payment) => payment.supplierId === supplier.id);
    const claims = data.supplierClaims!.filter((claim) => claim.supplierId === supplier.id);
    const received = data.receivingSessions!.filter((session) => pos.some((po) => po.id === session.purchaseOrderId));
    const damaged = received.reduce((sum, session) => sum + session.rows.reduce((rowSum, row) => rowSum + row.damagedQuantity, 0), 0);
    const units = received.reduce((sum, session) => sum + session.rows.reduce((rowSum, row) => rowSum + row.receivedQuantity, 0), 0);
    const defectRate = units ? damaged / units : 0;
    const averageLeadDays = supplier.leadDays || (pos.length ? 10 : 0);
    const onTimeRate = pos.length ? pos.filter((po) => po.status === "received").length / pos.length : 1;
    return { id: data.supplierScorecards?.find((entry) => entry.supplierId === supplier.id)?.id || id(), supplierId: supplier.id, qualityScore: round(Math.max(0, 100 - defectRate * 100)), leadTimeScore: round(Math.max(0, 100 - averageLeadDays)), communicationScore: supplier.contact || supplier.email ? 90 : 60, priceScore: 85, defectRate: round(defectRate), onTimeRate: round(onTimeRate), averageLeadDays, totalSpendUsd: round(payments.reduce((sum, payment) => sum + payment.amountUsd, 0)), claimCount: claims.length, lastReviewedAt: now(), updatedAt: now() };
  });
}

export function create1688PurchaseOrder(data: OperatingData, input: Create1688PurchaseInput) {
  ensurePurchasingCollections(data);
  if (input.idempotencyKey && data.purchaseApprovals!.some((approval) => approval.id === input.idempotencyKey)) return data;
  const supplier = data.suppliers.find((entry) => entry.id === input.supplierId);
  if (!supplier) throw new Error("Supplier not found.");
  if (!input.items.length) throw new Error("Purchase order needs at least one item.");
  const poId = id();
  const items = input.items.map((item) => {
    const variant = data.variants.find((entry) => entry.id === item.variantId);
    if (!variant || !isActiveVariant(data, variant)) throw new Error("Purchase item active variant not found.");
    return { id: id(), variantId: item.variantId, expectedQuantity: item.expectedQuantity, receivedQuantity: 0, unitCost: round(item.unitCost * input.exchangeRate) };
  });
  const subtotalUsd = round(input.items.reduce((sum, item) => sum + item.expectedQuantity * item.unitCost * input.exchangeRate, 0));
  const landed = round((input.domesticFreight || 0) * input.exchangeRate + (input.internationalFreight || 0) + (input.duties || 0) + (input.customs || 0));
  const po: PurchaseOrder = { id: poId, supplierId: supplier.id, reference: input.reference, status: "draft", orderedAt: now(), expectedAt: new Date(Date.now() + (supplier.leadDays || 12) * 86400000).toISOString(), totalCost: round(subtotalUsd + landed), itemCount: items.reduce((sum, item) => sum + item.expectedQuantity, 0), items };
  data.purchaseOrders.unshift(po);
  const approval: PurchaseApproval = { id: input.idempotencyKey || id(), purchaseOrderId: po.id, status: "requested", requestedAt: now(), reason: "1688 purchasing approval required before deposit." };
  data.purchaseApprovals!.unshift(approval);
  data.freightConsolidations!.unshift({ id: id(), supplierId: supplier.id, parcelIds: [], status: "planning", domesticFreightUsd: round((input.domesticFreight || 0) * input.exchangeRate), internationalFreightUsd: input.internationalFreight || 0, dutiesUsd: input.duties || 0, customsUsd: input.customs || 0, allocationMethod: "by_value", createdAt: now() });
  input.items.forEach((item) => data.supplierPriceHistory!.unshift({ id: id(), supplierId: supplier.id, variantId: item.variantId, currency: input.currency, unitCostOriginal: item.unitCost, exchangeRate: input.exchangeRate, unitCostUsd: round(item.unitCost * input.exchangeRate), capturedAt: now() }));
  data.exchangeRates!.unshift({ id: id(), baseCurrency: "RMB", quoteCurrency: "USD", rate: input.exchangeRate, effectiveAt: now(), source: "invoice", createdAt: now() });
  data.transactions.unshift({ id: id(), type: "inventory_purchase", amount: -po.totalCost, status: "pending", occurredAt: now(), purchaseOrderId: po.id, sourceType: "purchase_order", sourceId: po.id, description: `Committed purchase ${po.reference}`, category: "Purchase commitment", audit: [`${now()}: Purchase commitment created from 1688 PO.`] });
  activity(data, "1688 purchase order created", "purchase_order", po.id, `${po.reference} awaiting approval.`);
  refreshSupplierScorecards(data);
  return data;
}

export function approvePurchaseOrder(data: OperatingData, purchaseOrderId: string, approved = true, reason = "Approved") {
  ensurePurchasingCollections(data);
  const po = data.purchaseOrders.find((entry) => entry.id === purchaseOrderId);
  if (!po) throw new Error("Purchase order not found.");
  const approval = data.purchaseApprovals!.find((entry) => entry.purchaseOrderId === po.id) || { id: id(), purchaseOrderId: po.id, status: "requested" as const, requestedAt: now() };
  approval.status = approved ? "approved" : "rejected"; approval.reason = reason; approval.decidedAt = now();
  if (!data.purchaseApprovals!.some((entry) => entry.id === approval.id)) data.purchaseApprovals!.unshift(approval);
  po.status = approved ? "ordered" : "issue";
  activity(data, approved ? "Purchase order approved" : "Purchase order rejected", "purchase_order", po.id, reason);
  return data;
}

export function recordPurchasePayment(data: OperatingData, input: PaymentInput) {
  ensurePurchasingCollections(data);
  const po = data.purchaseOrders.find((entry) => entry.id === input.purchaseOrderId);
  if (!po) throw new Error("Purchase order not found.");
  const supplierId = po.supplierId;
  if (input.idempotencyKey && data.purchasePayments!.some((entry) => entry.idempotencyKey === input.idempotencyKey)) return data;
  const payment: PurchasePayment = { id: id(), purchaseOrderId: po.id, supplierId, type: input.type, currency: input.currency, amountOriginal: input.amountOriginal, exchangeRate: input.exchangeRate, amountUsd: round(input.amountOriginal * input.exchangeRate), status: "paid", paidAt: now(), idempotencyKey: input.idempotencyKey, createdAt: now() };
  data.purchasePayments!.unshift(payment);
  data.transactions.unshift({ id: id(), type: input.type === "freight" ? "freight" : input.type === "duty" || input.type === "customs" ? "duty" : "inventory_purchase", amount: -payment.amountUsd, status: "cleared", occurredAt: payment.paidAt!, purchaseOrderId: po.id, sourceType: "purchase_order", sourceId: po.id, description: `${input.type} payment for ${po.reference}`, category: "Purchase payment", idempotencyKey: input.idempotencyKey, audit: [`${now()}: ${input.currency} ${input.amountOriginal} at ${input.exchangeRate}.`] });
  activity(data, "Purchase payment recorded", "purchase_order", po.id, `${input.type} ${payment.amountUsd.toFixed(2)} USD.`);
  refreshSupplierScorecards(data);
  return data;
}

export function receivePurchaseParcelToLots(data: OperatingData, input: ReceivePurchaseInput) {
  ensurePurchasingCollections(data);
  const po = data.purchaseOrders.find((entry) => entry.id === input.purchaseOrderId);
  if (!po) throw new Error("Purchase order not found.");
  if (input.idempotencyKey && data.receivingSessions!.some((session) => session.idempotencyKey === input.idempotencyKey)) return data;
  const rows = input.rows.map((row) => {
    const poItem = po.items.find((item) => item.id === row.purchaseOrderItemId);
    if (!poItem) throw new Error("Purchase order item not found.");
    const damaged = row.damagedQuantity || 0;
    const overage = row.overageQuantity || Math.max(0, row.receivedQuantity - (poItem.expectedQuantity - poItem.receivedQuantity));
    const shortage = Math.max(0, poItem.expectedQuantity - poItem.receivedQuantity - row.receivedQuantity);
    poItem.receivedQuantity += row.receivedQuantity;
    return { id: id(), purchaseOrderItemId: poItem.id, variantId: poItem.variantId, expectedQuantity: poItem.expectedQuantity, receivedQuantity: row.receivedQuantity, damagedQuantity: damaged, shortageQuantity: shortage, overageQuantity: overage, notes: row.notes };
  });
  const session: ReceivingSession = { id: id(), purchaseOrderId: po.id, parcelId: input.parcelId, status: rows.some((row) => row.shortageQuantity || row.damagedQuantity || row.overageQuantity) ? "issue" : po.items.every((item) => item.receivedQuantity >= item.expectedQuantity) ? "completed" : "partial", receivedAt: now(), rows, idempotencyKey: input.idempotencyKey, createdAt: now() };
  data.receivingSessions!.unshift(session);
  po.status = session.status === "completed" ? "received" : session.status === "issue" ? "issue" : "partial";
  const landedCosts = data.freightConsolidations!.filter((entry) => entry.supplierId === po.supplierId).slice(0, 1).flatMap((entry) => [
    { type: "domestic_shipping" as const, description: "Domestic 1688 freight", amount: entry.domesticFreightUsd, currency: "USD" as const, allocationMethod: entry.allocationMethod },
    { type: "international_freight" as const, description: "International freight", amount: entry.internationalFreightUsd, currency: "USD" as const, allocationMethod: entry.allocationMethod },
    { type: "duty" as const, description: "Duties and customs", amount: entry.dutiesUsd + entry.customsUsd, currency: "USD" as const, allocationMethod: entry.allocationMethod },
  ]).filter((cost) => cost.amount > 0);
  receiveWholesalePurchaseBatch(data, { reference: `${po.reference}-RECEIPT-${session.id.slice(0, 6)}`, supplierId: po.supplierId, purchaseOrderId: po.id, currency: "USD", items: rows.filter((row) => row.receivedQuantity > 0).map((row) => { const poItem = po.items.find((item) => item.id === row.purchaseOrderItemId)!; return { variantId: row.variantId, quantity: row.receivedQuantity, unitCost: poItem.unitCost }; }), landedCosts, idempotencyKey: input.idempotencyKey });
  const issueRows = rows.filter((row) => row.shortageQuantity || row.damagedQuantity || row.overageQuantity);
  if (issueRows.length) {
    const claim: SupplierClaim = { id: id(), supplierId: po.supplierId, purchaseOrderId: po.id, receivingSessionId: session.id, type: issueRows.some((row) => row.damagedQuantity) ? "damaged" : issueRows.some((row) => row.shortageQuantity) ? "shortage" : "overage", status: "open", quantity: issueRows.reduce((sum, row) => sum + row.shortageQuantity + row.damagedQuantity + row.overageQuantity, 0), detail: "Receiving discrepancy created from parcel-to-lot receipt.", openedAt: now(), activity: [`${now()}: Claim opened from receiving session.`] };
    data.supplierClaims!.unshift(claim); session.claimId = claim.id;
  }
  activity(data, "Purchase parcel received to lots", "purchase_order", po.id, `${session.status} receipt with ${rows.length} row(s).`);
  refreshSupplierScorecards(data);
  return data;
}

export function generateReorderRecommendations(data: OperatingData) {
  ensurePurchasingCollections(data);
  for (const variant of activeVariants(data)) {
    const balance = data.balances.find((entry) => entry.variantId === variant.id);
    const available = balance ? availableUnits(balance) : 0;
    const incoming = balance?.incoming || 0;
    const safetyStock = Math.max(variant.reorderPoint, Math.ceil((variant.reorderQuantity || 1) / 2));
    if (available + incoming <= variant.reorderPoint && !data.reorderRecommendations!.some((entry) => entry.variantId === variant.id && entry.status === "open")) {
      data.reorderRecommendations!.unshift({ id: id(), variantId: variant.id, supplierId: data.products.find((product) => product.id === variant.productId)?.supplierId, recommendedQuantity: Math.max(variant.reorderQuantity, safetyStock - available - incoming), reorderPoint: variant.reorderPoint, safetyStock, available, incoming, velocity30d: 1, estimatedCostUsd: round(Math.max(variant.reorderQuantity, safetyStock - available - incoming) * variant.landedUnitCost), status: "open", createdAt: now() });
    }
  }
  activity(data, "Reorder recommendations refreshed", "reorder", "recommendations", `${data.reorderRecommendations!.filter((entry) => entry.status === "open").length} open recommendation(s).`);
  return data;
}

export function purchasingSummary(data: OperatingData) {
  ensurePurchasingCollections(data);
  return {
    suppliers: data.suppliers.length,
    scorecards: data.supplierScorecards!.length,
    openApprovals: data.purchaseApprovals!.filter((entry) => entry.status === "requested").length,
    payments: data.purchasePayments!.length,
    receivingSessions: data.receivingSessions!.length,
    openClaims: data.supplierClaims!.filter((entry) => !["closed", "credited", "rejected"].includes(entry.status)).length,
    reorderRecommendations: data.reorderRecommendations!.filter((entry) => entry.status === "open").length,
    committedSpendUsd: data.transactions.filter((entry) => entry.category === "Purchase commitment").reduce((sum, entry) => sum + Math.abs(entry.amount), 0),
  };
}
