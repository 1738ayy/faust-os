import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dir = path.join(root, "supabase", "migrations");
const files = fs.readdirSync(dir).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
const numbers = files.map((file) => Number(file.slice(0, 3)));
const duplicateNumbers = numbers.filter((number, index) => numbers.indexOf(number) !== index);
const gaps = numbers.flatMap((number, index) => index === 0 ? [] : numbers[index - 1] + 1 === number ? [] : [`${numbers[index - 1]}→${number}`]);
const requiredSnippets = [
  ["002_business_rpc_and_normalized_operations.sql", "create_business_with_defaults"],
  ["004_inventory_transactional_mutations.sql", "mutate_inventory_balance"],
  ["010_confirm_order_import_batch.sql", "confirm_order_import_batch"],
  ["011_fulfillment_transactional_operations.sql", "mutate_fulfillment_transactional"],
  ["012_finance_operating_ledger.sql", "financial"],
  ["015_listings_cross_listing.sql", "channel_listing"],
  ["018_automation_engine.sql", "automation"],
  ["021_ai_center_operating_assistant.sql", "ai_"],
  ["022_browser_extension_phase2.sql", "extension_devices"],
];
const missingSnippets = requiredSnippets.filter(([file, snippet]) => !fs.readFileSync(path.join(dir, file), "utf8").includes(snippet));
if (!files.length || duplicateNumbers.length || gaps.length || missingSnippets.length) {
  console.error(JSON.stringify({ ok: false, files: files.length, duplicateNumbers, gaps, missingSnippets }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, files: files.length, first: files[0], latest: files.at(-1), rollbackStrategy: "restore latest verified backup, then redeploy last known-good application artifact; migrations are forward-only and idempotent where possible" }, null, 2));
