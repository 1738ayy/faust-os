import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const migrationPath = path.join(process.cwd(), "supabase", "migrations", "028_listings_production_parity_composer.sql");

test("Listings 2.0 production migration persists composer, overrides, jobs, attempts, and RLS", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  for (const table of [
    "marketplace_account_defaults",
    "product_marketplace_overrides",
    "marketplace_listing_drafts",
    "marketplace_listing_draft_fields",
    "marketplace_listing_draft_revisions",
    "marketplace_listing_image_orders",
    "cross_listing_jobs",
    "marketplace_publish_tasks",
    "marketplace_publish_attempts",
    "product_listing_sync_reviews",
  ]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`), `${table} should be created`);
    assert.match(sql, new RegExp(`alter table public\\.%I enable row level security`), "migration should enable RLS through the table loop");
    assert.match(sql, new RegExp(table), `${table} should be included in policy loop`);
  }
  assert.match(sql, /public\.is_business_member\(business_id\)/);
  assert.match(sql, /public\.has_business_role\(business_id/);
  assert.match(sql, /owner/);
  assert.match(sql, /operations/);
  assert.match(sql, /mutate_listings_transactional_legacy/);
  assert.match(sql, /p_action = 'save-draft-field'/);
  assert.match(sql, /p_action = 'publish-product'/);
  assert.match(sql, /marketplace_publish_attempts/);
  assert.match(sql, /unique \(business_id, idempotency_key\)/);
});
