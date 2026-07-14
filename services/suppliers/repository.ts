import { createJsonRepository } from "@/services/storage/json-repository";
import type { Supplier } from "@/types/supplier";
export const suppliersRepository = createJsonRepository<Supplier>("suppliers");
