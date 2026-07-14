import { createJsonRepository } from "@/services/storage/json-repository";
import type { Parcel } from "@/types/parcel";
export const parcelsRepository = createJsonRepository<Parcel>("parcels");
