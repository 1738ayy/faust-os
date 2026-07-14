import "server-only";

import fs from "fs/promises";
import path from "path";

import type { SuperbuyProduct } from "@/types/superbuy-product";

const file = path.join(process.cwd(), ".faust", "latest-superbuy-product.json");

/** Temporary development adapter. Replace this module with a Supabase repository when persistence is enabled. */
export async function saveLatestImportedProduct(product: SuperbuyProduct) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(product, null, 2));
}

export async function getLatestImportedProduct(): Promise<SuperbuyProduct | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as SuperbuyProduct;
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}
