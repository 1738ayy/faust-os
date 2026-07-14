import "server-only";
import fs from "fs/promises";
import path from "path";
import type { BusinessSettings } from "@/types/settings";
const file = path.join(process.cwd(), ".faust", "settings.json");
const defaults = (): BusinessSettings => ({ id: "default", currency: "USD", warehouseName: "", targetMargin: 50, defaultMarketplace: "depop", updatedAt: new Date().toISOString() });
export async function getSettings(): Promise<BusinessSettings> { try { return JSON.parse(await fs.readFile(file, "utf8")) as BusinessSettings; } catch (error: unknown) { if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") return defaults(); throw error; } }
export async function saveSettings(changes: Partial<BusinessSettings>) { const current = await getSettings(); const next = { ...current, ...changes, id: "default" as const, updatedAt: new Date().toISOString() }; await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(next, null, 2)); return next; }
