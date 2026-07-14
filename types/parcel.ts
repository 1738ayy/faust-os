export type ParcelStatus = "draft" | "warehouse" | "consolidated" | "shipped" | "delivered" | "delayed";
export type Parcel = { id: string; trackingNumber: string; carrier?: string; status: ParcelStatus; weight?: number; dimensions?: string; destination?: string; estimatedArrival?: string; declaredValue?: number; notes?: string; createdAt: string; updatedAt: string };
