import { z } from "zod";

export const authCredentialsSchema = z.object({ email: z.string().trim().email().max(320), password: z.string().min(8).max(256) });
export const passwordRecoverySchema = z.object({ email: z.string().trim().email().max(320) });
export const passwordUpdateSchema = z.object({ password: z.string().min(8).max(256), confirmPassword: z.string().min(8).max(256) }).refine((value) => value.password === value.confirmPassword, { message: "Passwords do not match.", path: ["confirmPassword"] });
export const businessInputSchema = z.object({ name: z.string().trim().min(1).max(120), currency: z.string().regex(/^[A-Za-z]{3}$/).default("USD"), timezone: z.string().trim().min(1).max(100).default("America/New_York") });
export const orderStatusSchema = z.enum(["draft", "pending_payment", "paid", "confirmed", "inventory_reserved", "ready_to_pack", "packed", "label_purchased", "ready_to_ship", "shipped", "in_transit", "delivered", "closed", "cancelled", "return_requested", "return_in_transit", "returned", "refunded"]);
export const operatingActionSchema = z.discriminatedUnion("action", [z.object({ action: z.literal("reset"), mode: z.enum(["empty", "development_demo"]).optional() }), z.object({ action: z.literal("transition-order"), id: z.string().uuid(), status: orderStatusSchema }), z.object({ action: z.literal("receive-parcel"), id: z.string().uuid() })]);
export const settingsInputSchema = z.object({ currency: z.string().regex(/^[A-Za-z]{3}$/).optional(), warehouseName: z.string().trim().max(120).optional(), targetMargin: z.coerce.number().min(0).max(100).optional(), defaultMarketplace: z.string().trim().max(50).optional() });
export const inventoryMutationSchema = z.object({ quantity: z.coerce.number().int().min(0).optional(), status: z.enum(["planned", "available", "reserved", "sold", "damaged", "lost"]).optional(), warehouse: z.string().trim().max(120).optional(), shelf: z.string().trim().max(120).optional(), bin: z.string().trim().max(120).optional() }).refine((value) => Object.keys(value).length > 0, "At least one inventory field is required.");
const idempotencyKey = z.string().uuid().optional();
export const inventoryAdjustSchema = z.object({ balanceId: z.string().uuid(), quantity: z.coerce.number().int().refine((value) => value !== 0), reason: z.string().trim().min(2).max(500), notes: z.string().trim().max(1000).optional(), relatedEntityId: z.string().uuid().optional(), idempotencyKey });
export const inventoryTransferSchema = z.object({ sourceBalanceId: z.string().uuid(), destinationBalanceId: z.string().uuid(), quantity: z.coerce.number().int().positive(), notes: z.string().trim().max(500).optional(), idempotencyKey });
export const inventoryCycleCountSchema = z.object({ balanceId: z.string().uuid(), countedQuantity: z.coerce.number().int().min(0), idempotencyKey });
export const inventoryDamageSchema = z.object({ balanceId: z.string().uuid(), quantity: z.coerce.number().int().positive(), action: z.enum(["damage", "quarantine", "release_quarantine", "lost", "found"]), reason: z.string().trim().min(2).max(500), notes: z.string().trim().max(1000).optional(), relatedEntityId: z.string().uuid().optional(), idempotencyKey });
export const inventoryLocationSchema = z.object({ balanceId: z.string().uuid(), locationId: z.string().uuid(), reason: z.string().trim().min(2).max(500).default("Inventory location assigned"), notes: z.string().trim().max(1000).optional(), idempotencyKey });
const orderLineSchema = z.object({ productId: z.string().uuid().optional(), variantId: z.string().uuid(), listingId: z.string().uuid().optional(), title: z.string().trim().min(1).max(300).optional(), quantity: z.coerce.number().int().positive(), unitSellingPrice: z.coerce.number().nonnegative(), discountAllocation: z.coerce.number().nonnegative().optional(), taxAllocation: z.coerce.number().nonnegative().optional(), marketplaceFeeAllocation: z.coerce.number().nonnegative().optional(), paymentFeeAllocation: z.coerce.number().nonnegative().optional(), unitCost: z.coerce.number().nonnegative().optional() });
export const manualOrderSchema = z.object({ number: z.string().trim().max(100).optional(), marketplace: z.enum(["Depop", "eBay", "Etsy", "Mercari", "Poshmark", "Manual"]), customer: z.object({ name: z.string().trim().min(1).max(200), email: z.string().email().optional(), city: z.string().trim().max(120).optional(), state: z.string().trim().max(120).optional() }), items: z.array(orderLineSchema).min(1), shippingCharged: z.coerce.number().nonnegative().optional(), shippingCost: z.coerce.number().nonnegative().optional(), marketplaceFee: z.coerce.number().nonnegative().optional(), paymentFee: z.coerce.number().nonnegative().optional(), taxCollected: z.coerce.number().nonnegative().optional(), shipBy: z.string().datetime().optional(), notes: z.string().trim().max(2000).optional(), idempotencyKey });
export const orderActionSchema = z.discriminatedUnion("action", [z.object({ action: z.literal("reserve") }), z.object({ action: z.literal("cancel"), reason: z.string().trim().min(2).max(500) }), z.object({ action: z.literal("partial-cancel"), reason: z.string().trim().min(2).max(500), lines: z.array(z.object({ itemId: z.string().uuid(), quantity: z.coerce.number().int().positive() })).min(1) }), z.object({ action: z.literal("ready-to-pack") }), z.object({ action: z.literal("packed") }), z.object({ action: z.literal("attach-label"), trackingNumber: z.string().trim().min(2).max(200), labelUrl: z.string().url().optional() }), z.object({ action: z.literal("ready-to-ship") }), z.object({ action: z.literal("ship") }), z.object({ action: z.literal("in-transit") }), z.object({ action: z.literal("delivered") }), z.object({ action: z.literal("close") }), z.object({ action: z.literal("refund"), amount: z.coerce.number().positive(), reason: z.string().trim().min(2).max(500), itemId: z.string().uuid().optional(), quantity: z.coerce.number().int().positive().optional(), externalRefundId: z.string().trim().max(200).optional() }), z.object({ action: z.literal("return"), reason: z.string().trim().min(2).max(500), trackingNumber: z.string().trim().max(200).optional(), items: z.array(z.object({ orderItemId: z.string().uuid(), quantity: z.coerce.number().int().positive() })).min(1) }), z.object({ action: z.literal("receive-return"), returnId: z.string().uuid(), dispositions: z.array(z.object({ itemId: z.string().uuid(), quantity: z.coerce.number().int().positive(), disposition: z.enum(["available", "damaged", "quarantine"]) })).min(1) }) ]);
export const importBatchConfirmSchema = z.object({ batchId: z.string().uuid(), idempotencyKey: z.string().uuid().optional() });
export const orderImportResolutionSchema = z.object({ reviewId: z.string().uuid(), action: z.enum(["link_variant", "link_listing", "create_variant", "non_inventory", "ignore", "cancel", "reopen"]), variantId: z.string().uuid().optional(), listingId: z.string().uuid().optional(), productTitle: z.string().trim().max(200).optional(), variantSku: z.string().trim().max(120).optional() });
export const orderImportBatchActionSchema = z.discriminatedUnion("action", [z.object({ action: z.literal("confirm"), batchId: z.string().uuid() }), z.object({ action: z.literal("retry"), batchId: z.string().uuid() }), z.object({ action: z.literal("reopen"), batchId: z.string().uuid() }), z.object({ action: z.literal("archive"), batchId: z.string().uuid() })]);
export const savedOrderViewActionSchema = z.discriminatedUnion("action", [z.object({ action: z.literal("create"), name: z.string().trim().min(1).max(80), query: z.string().trim().max(120).optional(), marketplace: z.enum(["Depop", "eBay", "Etsy", "Mercari", "Poshmark", "Manual"]).optional(), status: orderStatusSchema.optional(), isDefault: z.boolean().optional() }), z.object({ action: z.literal("rename"), id: z.string().uuid(), name: z.string().trim().min(1).max(80) }), z.object({ action: z.literal("update"), id: z.string().uuid(), query: z.string().trim().max(120).optional(), marketplace: z.enum(["Depop", "eBay", "Etsy", "Mercari", "Poshmark", "Manual"]).optional(), status: orderStatusSchema.optional() }), z.object({ action: z.literal("duplicate"), id: z.string().uuid() }), z.object({ action: z.literal("delete"), id: z.string().uuid() }), z.object({ action: z.literal("default"), id: z.string().uuid() }), z.object({ action: z.literal("reorder"), ids: z.array(z.string().uuid()).min(1) })]);
export const bulkOrderActionSchema = z.object({ action: z.enum(["reserve", "release", "ready-to-pack", "packed", "attach-preset", "ready-to-ship", "ship", "cancel", "tag", "export"]), orderIds: z.array(z.string().uuid()).min(1), tag: z.string().trim().max(60).optional(), reason: z.string().trim().max(500).optional() });
export const orderNoticeActionSchema = z.object({ id: z.string().uuid(), action: z.enum(["read", "unread", "resolve", "reopen", "archive"]) });
export const fulfillmentActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("begin-picking"), orderId: z.string().uuid(), picker: z.string().trim().max(80).optional(), mode: z.enum(["single", "batch", "zone"]).default("single") }),
  z.object({ action: z.literal("complete-picking"), shipmentId: z.string().uuid(), outcomes: z.array(z.object({ itemId: z.string().uuid(), status: z.enum(["picked", "missing", "substituted", "damaged"]), notes: z.string().trim().max(300).optional() })).optional() }),
  z.object({ action: z.literal("begin-packing"), shipmentId: z.string().uuid(), packer: z.string().trim().max(80).optional(), station: z.string().trim().max(80).optional() }),
  z.object({ action: z.literal("complete-packing"), shipmentId: z.string().uuid(), packageType: z.enum(["poly_mailer", "box", "custom"]).default("poly_mailer"), weightOz: z.coerce.number().positive(), lengthIn: z.coerce.number().positive(), widthIn: z.coerce.number().positive(), heightIn: z.coerce.number().positive(), notes: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("validate-address"), shipmentId: z.string().uuid(), provider: z.enum(["local_mock", "manual_label", "marketplace_label", "easypost", "shippo"]).default("local_mock") }),
  z.object({ action: z.literal("override-address"), shipmentId: z.string().uuid(), reason: z.string().trim().min(2).max(500) }),
  z.object({ action: z.literal("get-rates"), shipmentId: z.string().uuid(), provider: z.enum(["local_mock", "easypost", "shippo"]).default("local_mock"), insurance: z.boolean().optional(), signature: z.boolean().optional() }),
  z.object({ action: z.literal("select-rate"), shipmentId: z.string().uuid(), rateId: z.string().trim().min(2).max(200) }),
  z.object({ action: z.literal("generate-label"), shipmentId: z.string().uuid(), carrier: z.string().trim().min(2).max(80), service: z.string().trim().min(2).max(80), postageCost: z.coerce.number().nonnegative(), insurance: z.boolean().optional(), signature: z.boolean().optional() }),
  z.object({ action: z.literal("attach-manual-label"), shipmentId: z.string().uuid(), trackingNumber: z.string().trim().min(2).max(200), labelUrl: z.string().trim().min(2).max(500), carrier: z.string().trim().max(80).optional(), service: z.string().trim().max(80).optional(), postageCost: z.coerce.number().nonnegative().optional() }),
  z.object({ action: z.literal("attach-marketplace-label"), shipmentId: z.string().uuid(), trackingNumber: z.string().trim().min(2).max(200), labelUrl: z.string().trim().min(2).max(500), carrier: z.string().trim().max(80).optional(), service: z.string().trim().max(80).optional(), postageCost: z.coerce.number().nonnegative().optional() }),
  z.object({ action: z.literal("print-label"), shipmentId: z.string().uuid(), kind: z.enum(["print", "reprint"]).default("print") }),
  z.object({ action: z.literal("void-label"), shipmentId: z.string().uuid(), reason: z.string().trim().min(2).max(500) }),
  z.object({ action: z.literal("regenerate-label"), shipmentId: z.string().uuid() }),
  z.object({ action: z.literal("refresh-tracking"), shipmentId: z.string().uuid() }),
  z.object({ action: z.literal("dispatch"), shipmentId: z.string().uuid() }),
  z.object({ action: z.literal("create-manifest"), carrier: z.string().trim().max(80).optional(), shipmentIds: z.array(z.string().uuid()).min(1) }),
  z.object({ action: z.literal("dispatch-manifest"), manifestId: z.string().uuid() }),
  z.object({ action: z.literal("hold-shipment"), shipmentId: z.string().uuid(), reason: z.string().trim().min(2).max(500) }),
  z.object({ action: z.literal("release-hold"), shipmentId: z.string().uuid() }),
  z.object({ action: z.literal("assign-fulfillment"), shipmentId: z.string().uuid(), picker: z.string().trim().max(80).optional(), packer: z.string().trim().max(80).optional(), station: z.string().trim().max(80).optional(), priority: z.enum(["standard", "high", "urgent"]).optional(), slaDeadline: z.string().datetime().optional() }),
  z.object({ action: z.literal("delivered"), shipmentId: z.string().uuid() }),
  z.object({ action: z.literal("returned"), shipmentId: z.string().uuid(), notes: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("record-exception"), orderId: z.string().uuid().optional(), shipmentId: z.string().uuid().optional(), type: z.enum(["missing_inventory", "damaged_package", "failed_scan", "duplicate_shipment", "invalid_address", "label_failure", "returned_to_sender", "carrier_delay", "lost_shipment", "customer_hold", "manual_review"]), severity: z.enum(["critical", "warning", "info"]), owner: z.string().trim().max(80).optional(), notes: z.string().trim().min(2).max(1000) }),
  z.object({ action: z.literal("resolve-exception"), exceptionId: z.string().uuid(), notes: z.string().trim().min(2).max(1000) }),
  z.object({ action: z.literal("reopen-exception"), exceptionId: z.string().uuid(), notes: z.string().trim().min(2).max(1000) }),
]);
const financeActionBase = {
  vendor: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  amount: z.coerce.number().optional(),
  date: z.string().trim().max(40).optional(),
  recurring: z.enum(["none", "weekly", "monthly", "annual"]).optional(),
  taxDeductible: z.boolean().optional(),
  receiptStatus: z.enum(["not_required", "pending_attachment", "attached"]).optional(),
  supplierId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  marketplace: z.enum(["Depop", "eBay", "Etsy", "Mercari", "Poshmark", "Manual"]).optional(),
  expectedAmount: z.coerce.number().optional(),
  actualAmount: z.coerce.number().optional(),
  fees: z.coerce.number().optional(),
  adjustments: z.coerce.number().optional(),
  externalPayoutId: z.string().trim().max(120).optional(),
  resolution: z.string().trim().max(500).optional(),
  month: z.string().trim().max(20).optional(),
  actualAmountBudget: z.coerce.number().optional(),
  alertThreshold: z.coerce.number().min(0).max(1).optional(),
  basisAmount: z.coerce.number().optional(),
  rate: z.coerce.number().optional(),
  sourceId: z.string().uuid().optional(),
  target: z.enum(["inventory", "shipping_reserve", "marketing", "operating_reserve", "tax_reserve", "owner_distribution"]).optional(),
  percentage: z.coerce.number().min(0).max(100).optional(),
  revenueMultiplier: z.coerce.number().positive().optional(),
  expenseMultiplier: z.coerce.number().positive().optional(),
  scenario: z.string().trim().max(80).optional(),
  assumption: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(1000).optional(),
  idempotencyKey: z.string().uuid().optional(),
};
const financeCreateShape = z.object({ ...financeActionBase, action: z.enum(["create-expense", "create-payout", "import-payout", "reconcile-payout", "create-budget", "yearly-template", "reserve-tax", "release-tax", "adjust-tax", "edit-allocation", "simulate-allocation", "approve-allocation", "configure-forecast"]) });
const financeExistingShape = z.object({ ...financeActionBase, action: z.enum(["edit-expense", "duplicate-expense", "archive-expense", "delete-expense", "resolve-payout", "reopen-payout", "archive-payout", "edit-budget", "duplicate-budget", "rollover-budget"]), id: z.string().uuid() });
export const financeActionSchema = z.discriminatedUnion("action", [financeCreateShape, financeExistingShape]);
const landedCostSchema = z.object({ type: z.enum(["product", "domestic_shipping", "international_freight", "duty", "tax", "agent_fee", "inspection", "packaging", "other"]), description: z.string().trim().min(1).max(200), amount: z.coerce.number().nonnegative(), currency: z.enum(["USD", "RMB"]), allocationMethod: z.enum(["by_quantity", "by_value", "by_weight", "manual"]) });
const wholesaleBatchItemSchema = z.object({ variantId: z.string().uuid(), quantity: z.coerce.number().int().positive(), unitCost: z.coerce.number().nonnegative(), weightOz: z.coerce.number().nonnegative().optional(), manualLandedCostUsd: z.coerce.number().nonnegative().optional(), physicalSku: z.string().trim().max(120).optional(), locationId: z.string().uuid().optional() });
export const wholesaleCoreActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("receive-batch"), reference: z.string().trim().min(1).max(120), supplierId: z.string().uuid().optional(), purchaseOrderId: z.string().uuid().optional(), currency: z.enum(["USD", "RMB"]), rmbUsdRate: z.coerce.number().positive().optional(), receivedAt: z.string().datetime().optional(), items: z.array(wholesaleBatchItemSchema).min(1), landedCosts: z.array(landedCostSchema).default([]), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("allocate-fifo"), orderId: z.string().uuid(), orderItemId: z.string().uuid(), quantity: z.coerce.number().int().positive().optional(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("receive-return"), orderId: z.string().uuid(), orderItemId: z.string().uuid(), quantity: z.coerce.number().int().positive(), returnId: z.string().uuid(), mode: z.enum(["original_lot", "returned_goods_lot"]), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("sync-channel-risk"), variantId: z.string().uuid(), listingId: z.string().uuid(), desiredQuantity: z.coerce.number().int().nonnegative(), physicalSku: z.string().trim().min(1).max(120), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("process-outbox"), failEventId: z.string().uuid().optional(), maxAttempts: z.coerce.number().int().min(1).max(10).optional() }),
]);
export const listingsActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create-five-drafts"), variantId: z.string().uuid(), physicalSku: z.string().trim().min(1).max(120).optional(), basePrice: z.coerce.number().positive().optional(), imageUrls: z.array(z.string().trim().min(1).max(1000)).optional(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("publish-draft"), draftId: z.string().uuid(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("confirm-external"), draftId: z.string().uuid(), externalListingId: z.string().trim().min(1).max(200), externalUrl: z.string().url(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("sync-quantity"), draftId: z.string().uuid(), quantity: z.coerce.number().int().nonnegative().optional(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("pause-draft"), draftId: z.string().uuid(), reason: z.string().trim().max(500).optional(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("delist-draft"), draftId: z.string().uuid(), reason: z.string().trim().max(500).optional(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("coordinate-sold"), draftId: z.string().uuid(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("retry-sync"), draftId: z.string().uuid(), idempotencyKey: z.string().uuid().optional() }),
]);
const purchaseItemSchema = z.object({ variantId: z.string().uuid(), expectedQuantity: z.coerce.number().int().positive(), unitCost: z.coerce.number().nonnegative() });
const receiveRowSchema = z.object({ purchaseOrderItemId: z.string().uuid(), receivedQuantity: z.coerce.number().int().nonnegative(), damagedQuantity: z.coerce.number().int().nonnegative().optional(), overageQuantity: z.coerce.number().int().nonnegative().optional(), notes: z.string().trim().max(500).optional() });
export const purchasingActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("seed-supplier-ops") }),
  z.object({ action: z.literal("create-1688-po"), supplierId: z.string().uuid(), reference: z.string().trim().min(1).max(120), currency: z.enum(["RMB", "USD"]), exchangeRate: z.coerce.number().positive(), items: z.array(purchaseItemSchema).min(1), domesticFreight: z.coerce.number().nonnegative().optional(), internationalFreight: z.coerce.number().nonnegative().optional(), duties: z.coerce.number().nonnegative().optional(), customs: z.coerce.number().nonnegative().optional(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("approve-po"), purchaseOrderId: z.string().uuid(), approved: z.boolean().default(true), reason: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("record-payment"), purchaseOrderId: z.string().uuid(), type: z.enum(["deposit", "final", "freight", "duty", "customs", "refund"]), currency: z.enum(["RMB", "USD"]), amountOriginal: z.coerce.number().positive(), exchangeRate: z.coerce.number().positive(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("receive-parcel-to-lots"), purchaseOrderId: z.string().uuid(), parcelId: z.string().uuid().optional(), rows: z.array(receiveRowSchema).min(1), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("generate-reorders") }),
]);

const analyticsReportPayload = {
  reportId: z.string().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  sections: z.array(z.string().trim().min(1)).optional(),
  metrics: z.array(z.string().trim().min(1)).optional(),
  filters: z.record(z.string(), z.string()).optional(),
  drilldowns: z.array(z.enum(["sku", "supplier", "lot", "marketplace", "order", "finance", "fulfillment"])).optional(),
  scheduleFrequency: z.enum(["none", "daily", "weekly", "monthly"]).optional(),
  recipients: z.array(z.string().trim().min(1)).optional(),
  rowCount: z.coerce.number().int().nonnegative().optional(),
  idempotencyKey: z.string().uuid().optional(),
};
export const analyticsActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create-report"), ...analyticsReportPayload }),
  z.object({ action: z.literal("update-report"), ...analyticsReportPayload, reportId: z.string().min(1) }),
  z.object({ action: z.literal("duplicate-report"), reportId: z.string().min(1) }),
  z.object({ action: z.literal("record-run"), reportId: z.string().min(1), filters: z.record(z.string(), z.string()).optional(), rowCount: z.coerce.number().int().nonnegative().optional() }),
]);

export const automationActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create-rule"), name: z.string().trim().min(1).max(140).optional(), templateId: z.string().optional(), triggerType: z.string().optional(), dryRun: z.boolean().optional(), enabled: z.boolean().optional(), priority: z.coerce.number().int().min(0).max(999).optional(), conditionMode: z.enum(["AND", "OR"]).optional(), samplePayload: z.record(z.string(), z.unknown()).optional(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("install-template"), templateId: z.string().min(1), name: z.string().trim().min(1).max(140).optional(), threshold: z.coerce.number().optional(), enabled: z.boolean().optional(), dryRun: z.boolean().optional(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.enum(["duplicate-rule", "enable-rule", "disable-rule", "archive-rule", "test-rule"]), ruleId: z.string().uuid() }),
  z.object({ action: z.enum(["pause-schedule", "resume-schedule"]), ruleId: z.string().uuid() }),
  z.object({ action: z.literal("trigger-run"), ruleId: z.string().uuid(), samplePayload: z.record(z.string(), z.unknown()).optional(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("trigger-event"), triggerType: z.string().min(1), samplePayload: z.record(z.string(), z.unknown()).optional(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("replay-dead-letter"), deadLetterId: z.string().uuid() }),
  z.object({ action: z.literal("worker-tick"), workerId: z.string().trim().max(120).optional(), concurrency: z.coerce.number().int().min(1).max(25).optional(), leaseTimeoutMs: z.coerce.number().int().min(1000).max(300000).optional(), pollingIntervalMs: z.coerce.number().int().min(250).max(60000).optional() }),
  z.object({ action: z.literal("expire-approvals") }),
  z.object({ action: z.enum(["approve-action", "reject-action", "retry-run", "cancel-run"]), runId: z.string().uuid() }),
]);

export const aiCenterActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ask-question"), question: z.string().trim().min(2).max(1000), conversationId: z.string().uuid().optional(), saveQuestion: z.boolean().optional(), provider: z.enum(["deterministic", "openai", "anthropic", "gemini"]).optional() }),
  z.object({ action: z.literal("daily-brief"), provider: z.enum(["deterministic", "openai", "anthropic", "gemini"]).optional() }),
  z.object({ action: z.literal("run-scenario"), name: z.string().trim().max(120).optional(), prompt: z.string().trim().min(2).max(1000), units: z.coerce.number().int().positive().max(100000).optional(), variantId: z.string().uuid().optional(), priceChangePercent: z.coerce.number().min(-80).max(200).optional(), supplierId: z.string().uuid().optional(), marketingBudgetChange: z.coerce.number().min(-100000).max(100000).optional(), reserveCash: z.coerce.number().min(0).max(1000000).optional() }),
  z.object({ action: z.literal("save-recommendation"), recommendationId: z.string().uuid() }),
  z.object({ action: z.literal("request-approval"), recommendationId: z.string().uuid(), reason: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("feedback"), messageId: z.string().uuid().optional(), recommendationId: z.string().uuid().optional(), rating: z.enum(["useful", "not_useful", "unsafe", "wrong"]), comment: z.string().trim().max(1000).optional() }),
]);

const extensionAssumptionsSchema = z.object({
  rmbUsdRate: z.coerce.number().positive().optional(),
  internationalFreightPerKgUsd: z.coerce.number().nonnegative().optional(),
  dutyRate: z.coerce.number().min(0).max(1).optional(),
  customsFlatUsd: z.coerce.number().nonnegative().optional(),
  expectedShippingUsd: z.coerce.number().nonnegative().optional(),
  packagingUsd: z.coerce.number().nonnegative().optional(),
  paymentFeeRate: z.coerce.number().min(0).max(1).optional(),
  paymentFeeFlatUsd: z.coerce.number().nonnegative().optional(),
  targetSalePriceUsd: z.coerce.number().positive().optional(),
  quantity: z.coerce.number().int().positive().optional(),
}).passthrough();

const extensionArtifactSchema = z.object({
  type: z.enum(["screenshot", "dom_snapshot", "log", "failed_field", "publish_confirmation"]).optional(),
  url: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  failedSelector: z.string().trim().max(500).optional(),
  pageVersion: z.string().trim().max(120).optional(),
  currentUrl: z.string().url().optional(),
  domSnapshotHash: z.string().trim().max(200).optional(),
  log: z.string().trim().max(5000).optional(),
  marketplace: z.enum(["Depop", "eBay", "Etsy", "Mercari", "Poshmark", "Manual"]).optional(),
});

export const extensionActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("register-device"), deviceName: z.string().trim().min(1).max(120), browser: z.string().trim().min(1).max(120), environment: z.enum(["local", "staging", "production"]), version: z.string().trim().min(1).max(40), permissions: z.array(z.string().trim().min(1).max(120)).max(50), deviceId: z.string().uuid().optional(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("revoke-device"), deviceId: z.string().uuid(), reason: z.string().trim().max(500).optional(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("scan-intake"), payload: z.record(z.string(), z.unknown()), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("analyze"), product: z.record(z.string(), z.unknown()), assumptions: extensionAssumptionsSchema.optional(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("import-product"), product: z.record(z.string(), z.unknown()), assumptions: extensionAssumptionsSchema.optional(), approved: z.boolean(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("create-publish-job"), draftId: z.string().uuid(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("confirm-publish"), draftId: z.string().uuid(), externalListingId: z.string().trim().min(1).max(200), externalUrl: z.string().url(), finalTitle: z.string().trim().max(120).optional(), finalPrice: z.coerce.number().positive().optional(), evidence: extensionArtifactSchema.optional(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("report-error"), draftId: z.string().uuid().optional(), marketplace: z.enum(["Depop", "eBay", "Etsy", "Mercari", "Poshmark", "Manual"]).optional(), reason: z.string().trim().min(2).max(1000), classification: z.enum(["retryable", "permanent"]).optional(), screenshotUrl: z.string().url().optional(), artifact: extensionArtifactSchema.optional(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.literal("sync-quantity"), draftId: z.string().uuid(), quantity: z.coerce.number().int().nonnegative().optional(), idempotencyKey: z.string().uuid().optional() }),
  z.object({ action: z.enum(["pause-draft", "delist-draft"]), draftId: z.string().uuid(), reason: z.string().trim().max(500).optional(), idempotencyKey: z.string().uuid().optional() }),
]);
