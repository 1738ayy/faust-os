export type ActivityEvent = { id: string; type: "opportunity_saved" | "inventory_updated" | "order_saved" | "parcel_saved" | "supplier_saved"; title: string; detail?: string; createdAt: string };
