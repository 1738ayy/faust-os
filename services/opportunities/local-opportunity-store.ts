import "server-only";

import fs from "fs/promises";
import path from "path";

import type { Opportunity } from "@/types/opportunity";

const file = path.join(process.cwd(), ".faust", "opportunities.json");

async function readAll(): Promise<Opportunity[]> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as Opportunity[];
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

export async function getOpportunities(): Promise<Opportunity[]> {
  return readAll();
}

/** Development repository. A Supabase repository can implement this exact boundary later. */
export async function saveOpportunity(opportunity: Opportunity) {
  const opportunities = await readAll();
  const existing = opportunities.findIndex((item) => item.id === opportunity.id);
  if (existing >= 0) opportunities[existing] = opportunity;
  else opportunities.unshift(opportunity);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(opportunities, null, 2));
  return opportunity;
}
