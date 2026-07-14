export type BusinessToolName = "getRevenue" | "getProfit" | "getLowStock" | "getDeadInventory" | "getMarketplacePerformance" | "getSupplierPerformance" | "getOrderDetails" | "getDeployableCash" | "getShipmentExceptions";
export type BusinessTool = { name: BusinessToolName; execute: (input: Record<string, unknown>) => Promise<unknown> };
export interface AiProviderAdapter { readonly provider: string; summarize(prompt: string, tools: BusinessTool[]): Promise<string>; }
export class DeterministicInsightAdapter implements AiProviderAdapter { readonly provider = "deterministic-local"; async summarize(prompt: string) { return `Local insight mode is active. ${prompt}`; } }
