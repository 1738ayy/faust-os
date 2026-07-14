import { createJsonRepository } from "@/services/storage/json-repository";
import type { ActivityEvent } from "@/types/activity";
export const activityRepository = createJsonRepository<ActivityEvent>("activity");
export async function recordActivity(event: Omit<ActivityEvent, "id" | "createdAt">) { return activityRepository.upsert({ ...event, id: crypto.randomUUID(), createdAt: new Date().toISOString() }); }
