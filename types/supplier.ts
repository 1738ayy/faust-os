export type SupplierRisk = "unknown" | "low" | "medium" | "high";
export type Supplier = { id: string; name: string; storeName?: string; storeUrl?: string; factoryName?: string; contacts?: string; notes?: string; risk: SupplierRisk; createdAt: string; updatedAt: string };
