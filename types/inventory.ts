export type InventoryStatus = "planned" | "available" | "reserved" | "sold" | "damaged" | "lost";

export type InventoryItem = {
  id: string;
  opportunityId: string;
  sku: string;
  productName: string;
  supplier?: string;
  quantity: number;
  warehouse?: string;
  shelf?: string;
  bin?: string;
  costBasis: number;
  status: InventoryStatus;
  createdAt: string;
  updatedAt: string;
};
