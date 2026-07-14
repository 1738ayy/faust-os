export type OrderStatus = "draft" | "paid" | "processing" | "shipped" | "delivered" | "refunded" | "returned";
export type Order = { id: string; customer: string; marketplace: string; itemName: string; salePrice: number; shippingCost: number; trackingNumber?: string; status: OrderStatus; orderedAt: string; notes?: string; createdAt: string; updatedAt: string };
