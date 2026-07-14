import "server-only";
import fs from "fs/promises";
import path from "path";
import type { InventoryItem } from "@/types/inventory";
import type { Opportunity } from "@/types/opportunity";
import { analyzeOpportunity } from "@/lib/analyze-opportunity";

const file = path.join(process.cwd(), ".faust", "inventory.json");
async function readAll(): Promise<InventoryItem[]> { try { return JSON.parse(await fs.readFile(file, "utf8")) as InventoryItem[]; } catch (error: unknown) { if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") return []; throw error; } }
async function writeAll(items: InventoryItem[]) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(items, null, 2)); }
export async function getInventory(): Promise<InventoryItem[]> { return readAll(); }
export async function updateInventoryItem(id: string, changes: Partial<InventoryItem>) { const items = await readAll(); const index = items.findIndex((item) => item.id === id); if (index < 0) throw new Error("Inventory item not found."); const updated = { ...items[index], ...changes, id, updatedAt: new Date().toISOString() }; items[index] = updated; await writeAll(items); return updated; }
/** A saved opportunity starts as planned inventory and can later be received into a warehouse. */
export async function ensureInventoryForOpportunity(opportunity: Opportunity) { const items = await readAll(); const existing = items.find((item) => item.opportunityId === opportunity.id); if (existing) return existing; const now = new Date().toISOString(); const item: InventoryItem = { id: crypto.randomUUID(), opportunityId: opportunity.id, sku: `FAUST-${opportunity.id.slice(0, 8).toUpperCase()}`, productName: opportunity.product.name, supplier: opportunity.product.supplier.name, quantity: 0, costBasis: analyzeOpportunity(opportunity).capitalRequired, status: "planned", createdAt: now, updatedAt: now }; items.unshift(item); await writeAll(items); return item; }
