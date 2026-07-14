import "server-only";
import fs from "fs/promises";
import path from "path";

export function createJsonRepository<T extends { id: string }>(name: string) {
  const file = path.join(process.cwd(), ".faust", `${name}.json`);
  async function all(): Promise<T[]> { try { return JSON.parse(await fs.readFile(file, "utf8")) as T[]; } catch (error: unknown) { if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") return []; throw error; } }
  async function save(items: T[]) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(items, null, 2)); }
  return { all, async upsert(item: T) { const items = await all(); const index = items.findIndex((existing) => existing.id === item.id); if (index >= 0) items[index] = item; else items.unshift(item); await save(items); return item; }, async remove(id: string) { await save((await all()).filter((item) => item.id !== id)); } };
}
