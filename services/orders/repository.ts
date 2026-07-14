import { createJsonRepository } from "@/services/storage/json-repository";
import type { Order } from "@/types/order";
export const ordersRepository = createJsonRepository<Order>("orders");
