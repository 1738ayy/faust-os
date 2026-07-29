import fs from "node:fs";
import path from "node:path";
import type { OperatingData, Product, Variant } from "../domain/business";
import type { SuperbuyProduct } from "../types/superbuy-product";
import { importExtensionProduct } from "./browser-extension";
import { buildProductKnowledgeFromSuperbuy } from "./product-knowledge";
import { buildProductExperiences } from "./product-experience";
import { buildProductPipeline, syncProductPipelineState } from "./product-pipeline";
import { createFiveChannelDrafts, createCrossListingPublishJob } from "./listings-core";
import { createAutomationRule, runAutomationRule } from "./automations";

export type WorkflowProfile = { label: string; durationMs: number; count?: number };
export type LoadProfile = { productCount: number; profiles: WorkflowProfile[]; heapUsedMb: number; heapDeltaMb: number };
export type MigrationAuditResult = { fileCount: number; latest: string; missingIndexes: string[]; missingRls: string[]; missingForeignKeys: string[]; missingNotify: string[]; destructiveStatements: string[] };
export type SecurityAuditResult = { publicSecretLeaks: string[]; unsafeLogs: string[]; validationRoutesChecked: number; rlsTablesChecked: number };
export type TechnicalDebtResult = { actionMarkers: string[]; legacyMarkers: string[]; duplicateUtilityHints: string[] };

const now = "2026-07-29T00:00:00.000Z";
const uuid = (prefix: string, index: number) => `${prefix}${String(index).padStart(12, "0")}`.slice(0, 8) + "-0000-4000-8000-" + String(index).padStart(12, "0").slice(0, 12);

export function emptyOperatingData(): OperatingData {
  return { version: 1, mode: "local", updatedAt: now, products: [], variants: [], locations: [{ id: uuid("loc", 1), label: "Main Warehouse", warehouse: "Main" }], balances: [], stockMovements: [], suppliers: [{ id: uuid("sup", 1), name: "Load Test Supplier", sourcePlatform: "1688", status: "active" }], purchaseOrders: [], parcels: [], listings: [], customers: [], orders: [], transactions: [], tasks: [], notices: [], insights: [], activity: [], productImages: [], productKnowledgeEvidence: [], productKnowledgeFields: [], productKnowledgeDecisions: [], productKnowledgeMemory: [], productKnowledgeConfidenceHistory: [], channelListingDrafts: [], listingSyncJobs: [], listingReviewItems: [], marketplaceAccounts: [], listingTemplates: [], physicalSkuMappings: [], outboxEvents: [], durableJobs: [], deadLetters: [], channelSyncStates: [], inventoryRiskLocks: [] };
}

export function syntheticProduct(index: number): { product: Product; variant: Variant } {
  const productId = uuid("prd", index);
  const variantId = uuid("var", index);
  return {
    product: { id: productId, title: `Load test product ${index}`, category: index % 3 === 0 ? "T-shirt" : "Accessories", tags: ["load-test"], supplierId: uuid("sup", 1), sourceUrl: `https://detail.1688.com/offer/load-${index}.html`, image: `https://img.example.test/load-${index}.jpg`, images: [`https://img.example.test/load-${index}.jpg`], status: "active", createdAt: now, updatedAt: now },
    variant: { id: variantId, productId, sku: `FST-LOAD-${String(index).padStart(6, "0")}`, title: "Default", condition: "New", landedUnitCost: 10 + index % 13, defaultSalePrice: 35 + index % 21, weightOz: 12 + index % 8, reorderPoint: 2, reorderQuantity: 8, active: true },
  };
}

export function createSyntheticOperatingData(productCount: number): OperatingData {
  const data = emptyOperatingData();
  for (let index = 1; index <= productCount; index += 1) {
    const { product, variant } = syntheticProduct(index);
    data.products.push(product);
    data.variants.push(variant);
    data.balances.push({ id: uuid("bal", index), variantId: variant.id, locationId: data.locations[0].id, onHand: index % 5 === 0 ? 0 : 6 + index % 20, reserved: index % 7, incoming: index % 11, damaged: 0, returned: 0, lost: 0, quarantined: 0 });
  }
  return data;
}

function sourceFor(index: number): SuperbuyProduct {
  return { source: "1688", importedAt: now, title: `Load imported tee ${index}`, superbuyUrl: `https://detail.1688.com/offer/import-${index}.html`, storeName: "Load Test Supplier", category: "Item", rawAttributes: { "Product Category": "T-shirt", "Main Fabric Composition": "Cotton" }, images: [`https://img.example.test/import-${index}.jpg`], variants: [{ id: `black-${index}`, name: "Black / L", options: ["Black", "L"], price: 18, stock: 9 }], price: 18, domesticShipping: 6, weight: "260g" };
}

function measure<T>(label: string, profiles: WorkflowProfile[], run: () => T, count?: number): T {
  const started = performance.now();
  const result = run();
  profiles.push({ label, durationMs: Math.round((performance.now() - started) * 10) / 10, count });
  return result;
}

export function profileProductionWorkflows(productCount: number): LoadProfile {
  const heapStart = process.memoryUsage().heapUsed;
  const profiles: WorkflowProfile[] = [];
  const data = measure("synthetic data generation", profiles, () => createSyntheticOperatingData(productCount), productCount);
  measure("Product Knowledge generation", profiles, () => {
    const limit = Math.min(productCount, 200);
    for (let index = 1; index <= limit; index += 1) buildProductKnowledgeFromSuperbuy(data, data.products[index - 1].id, sourceFor(index));
  }, Math.min(productCount, 200));
  measure("Product import latency", profiles, () => {
    for (let index = 1; index <= 25; index += 1) importExtensionProduct(data, sourceFor(index + productCount), {}, `load-import-${productCount}-${index}`);
  }, 25);
  const experiences = measure("Repository query hydration and Product Experience build", profiles, () => buildProductExperiences(data), data.variants.length);
  const pipeline = measure("Pipeline updates", profiles, () => buildProductPipeline(data, experiences), experiences.length);
  measure("Action Center state sync", profiles, () => syncProductPipelineState(data, pipeline), pipeline.workItems.length);
  measure("Draft generation", profiles, () => {
    for (const variant of data.variants.slice(0, 50)) createFiveChannelDrafts(data, { variantId: variant.id, basePrice: variant.defaultSalePrice, imageUrls: [`https://img.example.test/${variant.sku}.jpg`], idempotencyKey: `load-drafts:${variant.id}` });
  }, Math.min(50, data.variants.length));
  measure("Marketplace publish path", profiles, () => createCrossListingPublishJob(data, { productId: data.products[0].id, idempotencyKey: `load-publish:${productCount}` }), 1);
  measure("Automation execution", profiles, () => {
    const rule = createAutomationRule(data, { name: "Load low stock alert", enabled: true, dryRun: true, triggerType: "inventory.below_reorder_point", samplePayload: { available: 1, reorderPoint: 2, sku: data.variants[0].sku } });
    runAutomationRule(data, rule.id, rule.trigger.samplePayload, `load-automation:${productCount}`);
  }, 1);
  measure("Repository serialization", profiles, () => JSON.stringify(data).length, data.products.length);
  const heapEnd = process.memoryUsage().heapUsed;
  return { productCount, profiles, heapUsedMb: Math.round(heapEnd / 1024 / 1024), heapDeltaMb: Math.round((heapEnd - heapStart) / 1024 / 1024) };
}

export function auditMigrations(root = process.cwd()): MigrationAuditResult {
  const dir = path.join(root, "supabase", "migrations");
  const files = fs.readdirSync(dir).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
  const result: MigrationAuditResult = { fileCount: files.length, latest: files.at(-1) || "", missingIndexes: [], missingRls: [], missingForeignKeys: [], missingNotify: [], destructiveStatements: [] };
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    if (/create table/i.test(sql) && !/create index if not exists/i.test(sql)) result.missingIndexes.push(file);
    if (/create table/i.test(sql) && !/enable\s+row\s+level\s+security/i.test(sql)) result.missingRls.push(file);
    if (/create table/i.test(sql) && !/references public\./i.test(sql)) result.missingForeignKeys.push(file);
    if (/create table|alter table|create policy/i.test(sql) && !/notify pgrst, 'reload schema'/i.test(sql)) result.missingNotify.push(file);
    if (/\bdrop table\b|\btruncate\b|\bdelete from\b/i.test(sql)) result.destructiveStatements.push(file);
  }
  return result;
}

export function securityAudit(root = process.cwd()): SecurityAuditResult {
  const files = walk(root).filter((file) => /\.(ts|tsx|mjs|sql)$/.test(file) && !file.includes(`${path.sep}.next${path.sep}`) && !file.includes(`${path.sep}node_modules${path.sep}`) && !file.includes(`${path.sep}tests${path.sep}`));
  const publicSecretLeaks: string[] = [];
  const unsafeLogs: string[] = [];
  let validationRoutesChecked = 0;
  for (const file of files) {
    const relative = path.relative(root, file);
    const text = fs.readFileSync(file, "utf8");
    if (/\bNEXT_PUBLIC_[A-Z0-9_]*(SERVICE_ROLE|SECRET|PRIVATE|TOKEN)[A-Z0-9_]*\s*[:=]/i.test(text)) publicSecretLeaks.push(relative);
    if (/console\.log\(.*(key|secret|token|password)/i.test(text)) unsafeLogs.push(relative);
    if (relative.startsWith(`app${path.sep}api`) && /Schema\.parse|schema\.parse|z\./.test(text)) validationRoutesChecked += 1;
  }
  const rlsTablesChecked = fs.readdirSync(path.join(root, "supabase", "migrations")).reduce((count, file) => count + (fs.readFileSync(path.join(root, "supabase", "migrations", file), "utf8").match(/enable row level security/gi)?.length || 0), 0);
  return { publicSecretLeaks, unsafeLogs, validationRoutesChecked, rlsTablesChecked };
}

export function technicalDebtAudit(root = process.cwd()): TechnicalDebtResult {
  const files = walk(root).filter((file) => /\.(ts|tsx|mjs|md)$/.test(file) && !file.includes(`${path.sep}.next${path.sep}`) && !file.includes(`${path.sep}node_modules${path.sep}`) && !file.includes(`${path.sep}.test-build${path.sep}`));
  const actionMarkers: string[] = [];
  const legacyMarkers: string[] = [];
  for (const file of files) {
    const relative = path.relative(root, file);
    const text = fs.readFileSync(file, "utf8");
    if (/TODO|FIXME/i.test(text)) actionMarkers.push(relative);
    if (/temporary|legacy|workaround/i.test(text)) legacyMarkers.push(relative);
  }
  return { actionMarkers: [...new Set(actionMarkers)].slice(0, 25), legacyMarkers: [...new Set(legacyMarkers)].slice(0, 25), duplicateUtilityHints: [] };
}

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if ([".git", ".next", "node_modules", ".test-build", "test-results"].includes(entry.name)) return [];
      return walk(full);
    }
    return [full];
  });
}
