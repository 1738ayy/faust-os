import type { OperatingData } from "../domain/business";
import type { ProductExperience } from "./product-experience";

export const productPipelineStages = [
  "imported",
  "analyzing",
  "needs_review",
  "ready",
  "drafted",
  "ready_to_publish",
  "publishing",
  "published",
  "monitoring",
  "sold",
  "archived",
] as const;

export type ProductPipelineStage = typeof productPipelineStages[number];
export type WorkSeverity = "critical" | "high" | "medium" | "low";
export type WorkItemKind =
  | "review_category"
  | "review_material"
  | "review_cover"
  | "exclude_image"
  | "add_weight"
  | "receive_inventory"
  | "generate_drafts"
  | "publish_ready"
  | "fix_listing"
  | "sync_failure"
  | "monitor_product";

export type ProductWorkItem = {
  id: string;
  productId: string;
  variantId: string;
  sku: string;
  productTitle: string;
  stage: ProductPipelineStage;
  kind: WorkItemKind;
  title: string;
  detail: string;
  severity: WorkSeverity;
  estimatedEffortSeconds: number;
  expectedBenefit: string;
  readinessImpact: number;
  blocksDownstream: boolean;
  suggestedAction: string;
  href: string;
  action:
    | { type: "approve_knowledge"; productId: string; fieldKeys: string[] }
    | { type: "approve_cover"; productId: string }
    | { type: "exclude_image"; productId: string; imageId: string }
    | { type: "generate_drafts"; variantId: string; basePrice: number; imageUrls: string[] }
    | { type: "publish_product"; productId: string }
    | { type: "open"; href: string };
};

export type ProductPipelineItem = {
  productId: string;
  variantId: string;
  sku: string;
  title: string;
  href: string;
  stage: ProductPipelineStage;
  priorityScore: number;
  readinessScore: number;
  revenuePotential: number;
  inventoryAvailable: number;
  affectedDrafts: number;
  confidence: number;
  nextAction: string;
  workItems: ProductWorkItem[];
};

export type ProductPipelineSummary = {
  stageCounts: Record<ProductPipelineStage, number>;
  today: {
    imported: number;
    ready: number;
    published: number;
    sold: number;
    blocked: number;
  };
  inboxCounts: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  session: {
    productCount: number;
    estimatedMinutes: number;
    goal: string;
    items: ProductWorkItem[];
  };
};

export type ProductPipeline = {
  products: ProductPipelineItem[];
  workItems: ProductWorkItem[];
  summary: ProductPipelineSummary;
  recommended?: ProductWorkItem;
};

function todayPrefix(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function stageLabel(stage: ProductPipelineStage) {
  return stage.replaceAll("_", " ");
}

function severityWeight(severity: WorkSeverity) {
  return { critical: 110, high: 80, medium: 50, low: 25 }[severity];
}

function workId(item: ProductExperience, kind: WorkItemKind, suffix = "primary") {
  return `${item.product.id}:${item.variant.id}:${kind}:${suffix}`;
}

function productDrafts(data: OperatingData, item: ProductExperience) {
  return (data.channelListingDrafts || []).filter((draft) => draft.variantId === item.variant.id);
}

function productPublishTasks(data: OperatingData, item: ProductExperience) {
  const drafts = productDrafts(data, item);
  const draftIds = new Set(drafts.map((draft) => draft.id));
  return (data.marketplacePublishTasks || []).filter((task) => draftIds.has(task.draftId));
}

function deriveStage(data: OperatingData, item: ProductExperience): ProductPipelineStage {
  if (item.product.status === "paused" || item.product.status === "cancelled") return "archived";
  if (item.analytics.unitsSold > 0) return "sold";
  const tasks = productPublishTasks(data, item);
  if (tasks.some((task) => ["queued", "validating", "preparing_images", "uploading_images", "submitting", "confirming", "retry_wait"].includes(task.status))) return "publishing";
  if (item.marketplaces.some((marketplace) => marketplace.status === "live")) return item.intelligence.health.some((signal) => signal.status === "risk") ? "monitoring" : "published";
  const drafts = productDrafts(data, item);
  if (drafts.some((draft) => draft.status === "failed" || draft.validationErrors.length || draft.syncState === "failed")) return "needs_review";
  if (drafts.length >= 5 && item.readiness.score >= 80) return "ready_to_publish";
  if (drafts.length > 0) return "drafted";
  if (item.productKnowledge.overview.mustReview > 0 || item.visualIntelligence.conflict || item.readiness.missing.length) return "needs_review";
  if (item.productKnowledge.overview.evidenceCount > 0 && item.visualIntelligence.observability.imageObservationsCreated === 0) return "analyzing";
  if (item.readiness.score >= 85) return "ready";
  return "imported";
}

function baseWork(item: ProductExperience, stage: ProductPipelineStage, kind: WorkItemKind, title: string, detail: string, severity: WorkSeverity, impact: number, action: ProductWorkItem["action"], options: Partial<ProductWorkItem> = {}): ProductWorkItem {
  return {
    id: workId(item, kind, title.toLowerCase().replace(/[^a-z0-9]+/g, "-")),
    productId: item.product.id,
    variantId: item.variant.id,
    sku: item.variant.sku,
    productTitle: item.product.title,
    stage,
    kind,
    title,
    detail,
    severity,
    estimatedEffortSeconds: options.estimatedEffortSeconds || (severity === "critical" ? 20 : severity === "high" ? 12 : 6),
    expectedBenefit: options.expectedBenefit || `+${impact} readiness`,
    readinessImpact: impact,
    blocksDownstream: options.blocksDownstream ?? ["critical", "high"].includes(severity),
    suggestedAction: options.suggestedAction || "Review",
    href: options.href || item.href,
    action,
  };
}

function workItemsForProduct(data: OperatingData, item: ProductExperience, stage: ProductPipelineStage): ProductWorkItem[] {
  const items: ProductWorkItem[] = [];
  const mustReview = item.productKnowledge.reviewPlan.mustReview;
  const safeBulk = item.productKnowledge.reviewPlan.safeBulkApproval;
  const material = safeBulk.find((field) => field.fieldKey === "material" || field.fieldKey === "fabric_composition");
  const category = safeBulk.find((field) => field.fieldKey === "universal_category" || field.fieldKey === "product_type");
  const drafts = productDrafts(data, item);
  const failedDraft = drafts.find((draft) => draft.status === "failed" || draft.validationErrors.length);
  const syncFailure = drafts.find((draft) => draft.syncState === "failed");

  if (item.visualIntelligence.conflict || mustReview.some((field) => field.fieldKey === "universal_category" || field.fieldKey === "product_type")) {
    items.push(baseWork(item, stage, "review_category", "Confirm category", item.visualIntelligence.conflict?.message || "Category needs review before marketplace publishing.", "critical", 12, { type: "open", href: item.href }, { suggestedAction: "Review category", expectedBenefit: "+12 readiness · unblocks marketplace category", blocksDownstream: true }));
  } else if (category) {
    items.push(baseWork(item, stage, "review_category", "Approve supplier-confirmed category", `${category.fieldKey.replaceAll("_", " ")} is high-confidence and safe to approve.`, "medium", 8, { type: "approve_knowledge", productId: item.product.id, fieldKeys: [category.fieldKey] }, { suggestedAction: "Approve", estimatedEffortSeconds: 2 }));
  }

  if (mustReview.some((field) => field.fieldKey === "material" || field.fieldKey === "fabric_composition")) {
    items.push(baseWork(item, stage, "review_material", "Confirm material", "Material evidence conflicts or needs confirmation before listing copy is trusted.", "high", 8, { type: "open", href: item.href }, { suggestedAction: "Review material", blocksDownstream: true }));
  } else if (material) {
    items.push(baseWork(item, stage, "review_material", "Approve high-confidence material", `${String(material.value)} is supplier-backed and ready for approval.`, "medium", 8, { type: "approve_knowledge", productId: item.product.id, fieldKeys: [material.fieldKey] }, { suggestedAction: "Approve", estimatedEffortSeconds: 2 }));
  }

  if (item.visualIntelligence.recommendation?.status === "suggested" && item.visualIntelligence.recommendation.confidence >= 0.78) {
    items.push(baseWork(item, stage, "review_cover", "Approve recommended cover", item.visualIntelligence.recommendation.explanation, "medium", 7, { type: "approve_cover", productId: item.product.id }, { suggestedAction: "Approve cover", estimatedEffortSeconds: 2 }));
  }

  const excludedCandidate = item.visualIntelligence.qualities.find((quality) => quality.role === "size_chart" || quality.role === "detail");
  if (excludedCandidate) {
    items.push(baseWork(item, stage, "exclude_image", excludedCandidate.role === "size_chart" ? "Exclude size chart from publishing" : "Mark detail image as gallery-only", excludedCandidate.explanation, "low", 4, { type: "exclude_image", productId: item.product.id, imageId: excludedCandidate.imageId }, { suggestedAction: excludedCandidate.role === "size_chart" ? "Exclude" : "Mark detail", estimatedEffortSeconds: 2, blocksDownstream: false }));
  }

  if (!item.variant.weightOz) {
    items.push(baseWork(item, stage, "add_weight", "Add product weight", "Shipping profiles and marketplace drafts need product weight.", "high", 10, { type: "open", href: `${item.href}#details` }, { suggestedAction: "Add weight", blocksDownstream: true }));
  }

  if (item.inventory.available <= 0) {
    items.push(baseWork(item, stage, "receive_inventory", "Receive inventory", "Publishing is risky until sellable inventory exists.", "high", 14, { type: "open", href: "/inventory" }, { suggestedAction: "Receive inventory", expectedBenefit: "+14 readiness · unlocks publishing", blocksDownstream: true }));
  }

  if (stage === "ready" && drafts.length === 0) {
    items.push(baseWork(item, stage, "generate_drafts", "Generate five marketplace drafts", `${item.variant.sku} has strong readiness and no channel drafts yet.`, "high", 18, { type: "generate_drafts", variantId: item.variant.id, basePrice: item.variant.defaultSalePrice, imageUrls: item.product.images || [] }, { suggestedAction: "Generate drafts", expectedBenefit: "Creates five channel-specific drafts" }));
  }

  if (stage === "ready_to_publish") {
    items.push(baseWork(item, stage, "publish_ready", "Publish ready marketplaces", `${drafts.length} draft(s) are ready for marketplace execution.`, "high", 22, { type: "publish_product", productId: item.product.id }, { suggestedAction: "Publish", expectedBenefit: "Moves ready drafts into publishing" }));
  }

  if (failedDraft) {
    items.push(baseWork(item, stage, "fix_listing", "Fix listing validation", failedDraft.validationErrors[0] || "Marketplace draft needs review.", "critical", 15, { type: "open", href: "/listings" }, { suggestedAction: "Fix listing", blocksDownstream: true }));
  }

  if (syncFailure) {
    items.push(baseWork(item, stage, "sync_failure", "Resolve marketplace sync failure", `${syncFailure.marketplace} sync needs attention.`, "high", 10, { type: "open", href: "/listings" }, { suggestedAction: "Review sync", blocksDownstream: true }));
  }

  if (!items.length && ["published", "monitoring", "sold"].includes(stage)) {
    items.push(baseWork(item, stage, "monitor_product", "Monitor product health", "Watch pricing, inventory, and marketplace performance.", "low", 3, { type: "open", href: item.href }, { suggestedAction: "Open product", blocksDownstream: false }));
  }

  return items;
}

function priorityFor(item: ProductExperience, stage: ProductPipelineStage, workItems: ProductWorkItem[]) {
  const severity = workItems.length ? Math.max(...workItems.map((work) => severityWeight(work.severity))) : 0;
  const closestToPublishing = ["ready_to_publish", "ready", "drafted"].includes(stage) ? 35 : 0;
  const revenue = Math.min(40, Math.max(0, item.finance.projectedRevenue || item.finance.revenue) / 25);
  const inventory = Math.min(20, item.inventory.available * 2);
  const confidence = Math.round((item.ai.confidence || item.intelligence.recommendation.confidence) * 20);
  const affectedDrafts = productPipelineStages.indexOf(stage) >= productPipelineStages.indexOf("drafted") ? item.marketplaces.filter((market) => market.status !== "pending").length * 5 : 0;
  return Math.round(severity + closestToPublishing + revenue + inventory + confidence + affectedDrafts);
}

export function buildProductPipeline(data: OperatingData, products: ProductExperience[], now = new Date()): ProductPipeline {
  const prefix = todayPrefix(now);
  const pipelineProducts = products.map((item) => {
    const stage = deriveStage(data, item);
    const workItems = workItemsForProduct(data, item, stage);
    const revenuePotential = Math.max(0, item.finance.projectedRevenue || item.finance.revenue || item.variant.defaultSalePrice * Math.max(1, item.inventory.available));
    return {
      productId: item.product.id,
      variantId: item.variant.id,
      sku: item.variant.sku,
      title: item.product.title,
      href: item.href,
      stage,
      priorityScore: priorityFor(item, stage, workItems),
      readinessScore: item.readiness.score,
      revenuePotential,
      inventoryAvailable: item.inventory.available,
      affectedDrafts: item.marketplaces.filter((market) => market.status !== "pending").length,
      confidence: item.ai.confidence || item.intelligence.recommendation.confidence,
      nextAction: workItems[0]?.suggestedAction || item.readiness.nextAction,
      workItems,
    } satisfies ProductPipelineItem;
  }).sort((a, b) => b.priorityScore - a.priorityScore);

  const workItems = pipelineProducts.flatMap((item) => item.workItems)
    .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity) || b.readinessImpact - a.readinessImpact);
  const stageCounts = Object.fromEntries(productPipelineStages.map((stage) => [stage, pipelineProducts.filter((item) => item.stage === stage).length])) as Record<ProductPipelineStage, number>;
  const sessionItems = workItems.filter((item) => item.kind !== "monitor_product").slice(0, 24);
  return {
    products: pipelineProducts,
    workItems,
    summary: {
      stageCounts,
      today: {
        imported: products.filter((item) => item.product.createdAt.startsWith(prefix)).length,
        ready: pipelineProducts.filter((item) => ["ready", "ready_to_publish"].includes(item.stage)).length,
        published: pipelineProducts.filter((item) => ["published", "monitoring"].includes(item.stage)).length,
        sold: pipelineProducts.filter((item) => item.stage === "sold").length,
        blocked: workItems.filter((item) => item.blocksDownstream).length,
      },
      inboxCounts: {
        total: workItems.length,
        critical: workItems.filter((item) => item.severity === "critical").length,
        high: workItems.filter((item) => item.severity === "high").length,
        medium: workItems.filter((item) => item.severity === "medium").length,
        low: workItems.filter((item) => item.severity === "low").length,
      },
      session: {
        productCount: new Set(sessionItems.map((item) => item.productId)).size,
        estimatedMinutes: Math.max(1, Math.ceil(sessionItems.reduce((sum, item) => sum + item.estimatedEffortSeconds, 0) / 60)),
        goal: sessionItems.length ? "Ready for Publishing" : "Pipeline monitoring",
        items: sessionItems,
      },
    },
    recommended: workItems[0],
  };
}

export function productPipelineStageLabel(stage: ProductPipelineStage) {
  return stageLabel(stage).replace(/\b\w/g, (letter) => letter.toUpperCase());
}
