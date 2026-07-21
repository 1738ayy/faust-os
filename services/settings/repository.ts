import "server-only";
import fs from "fs/promises";
import path from "path";
import type { BusinessSettings } from "@/types/settings";
import { isProductionAuthEnabled } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/services/business/repository";
const file = path.join(process.cwd(), ".faust", "settings.json");
const defaults = (): BusinessSettings => ({ id: "default", currency: "USD", warehouseName: "", targetMargin: 50, defaultMarketplace: "depop", depopBoostEnabledByDefault: true, depopBoostRate: 12, updatedAt: new Date().toISOString() });
function fromAppearance(currency: string, updatedAt: string, appearance: unknown): BusinessSettings {
  const value = typeof appearance === "object" && appearance ? appearance as Partial<BusinessSettings> : {};
  return { ...defaults(), ...value, id: "default", currency: value.currency || currency || "USD", updatedAt };
}
async function getLocalSettings(): Promise<BusinessSettings> { try { return { ...defaults(), ...JSON.parse(await fs.readFile(file, "utf8")) as BusinessSettings }; } catch (error: unknown) { if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") return defaults(); throw error; } }
export async function getSettings(): Promise<BusinessSettings> {
  if (!isProductionAuthEnabled()) return getLocalSettings();
  const businessId = await getActiveBusinessId(); if (!businessId) return defaults();
  const client = await getSupabaseServerClient();
  const business = await client.from("businesses").select("currency").eq("id", businessId).single();
  const settings = await client.from("business_settings").select("appearance,updated_at").eq("business_id", businessId).single();
  if (business.error || settings.error) return defaults();
  return fromAppearance(String(business.data.currency || "USD"), String(settings.data.updated_at || new Date().toISOString()), settings.data.appearance);
}
export async function saveSettings(changes: Partial<BusinessSettings>) {
  const current = await getSettings(); const next = { ...current, ...changes, id: "default" as const, updatedAt: new Date().toISOString() };
  if (isProductionAuthEnabled()) {
    const businessId = await getActiveBusinessId(); if (!businessId) throw new Error("No business workspace is selected.");
    const client = await getSupabaseServerClient();
    if (changes.currency) { const { error } = await client.from("businesses").update({ currency: next.currency.toUpperCase() }).eq("id", businessId); if (error) throw error; }
    const { error } = await client.from("business_settings").upsert({ business_id: businessId, appearance: next, updated_at: next.updatedAt }, { onConflict: "business_id" });
    if (error) throw error;
    return next;
  }
  await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(next, null, 2)); return next;
}
