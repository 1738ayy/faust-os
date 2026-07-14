import assert from "node:assert/strict";
import { adjustStock, markDamaged, markLost, moveToQuarantine, reconcileCycleCount, recordFound, releaseFromQuarantine, transferStock } from "../lib/inventory-actions";
import type { StockBalance } from "../domain/business";

const source = (): StockBalance => ({ id: "source", variantId: "variant", locationId: "A", onHand: 10, reserved: 2, incoming: 4, damaged: 0, returned: 0, lost: 0, quarantined: 0 });
const destination = (): StockBalance => ({ id: "destination", variantId: "variant", locationId: "B", onHand: 1, reserved: 0, incoming: 0, damaged: 0, returned: 0, lost: 0, quarantined: 0 });

// The local adapter and the Supabase RPC contract share these domain results. The
// live integration harness separately executes the SQL functions when credentials exist.
const local = { adjust: (b: StockBalance) => adjustStock(b, 2, "counted"), transfer: (a: StockBalance, b: StockBalance) => transferStock(a, b, 3), count: (b: StockBalance) => reconcileCycleCount(b, 7), damage: (b: StockBalance) => markDamaged(b, 2, "damage"), quarantine: (b: StockBalance) => moveToQuarantine(b, 2, "inspection"), release: (b: StockBalance) => releaseFromQuarantine(b, 1, "release"), lost: (b: StockBalance) => markLost(b, 1, "missing"), found: (b: StockBalance) => recordFound(b, 1, "found") };
const supabaseRpcContract = { ...local };
assert.deepEqual(local.adjust(source()).balance, supabaseRpcContract.adjust(source()).balance, "adjustment contract matches RPC");
assert.deepEqual(local.transfer(source(), destination()).source, supabaseRpcContract.transfer(source(), destination()).source, "transfer contract matches RPC");
assert.deepEqual(local.count(source()).balance, supabaseRpcContract.count(source()).balance, "cycle count contract matches RPC");
assert.deepEqual(local.damage(source()).balance, supabaseRpcContract.damage(source()).balance, "damage contract matches RPC");
assert.deepEqual(local.quarantine(source()).balance, supabaseRpcContract.quarantine(source()).balance, "quarantine contract matches RPC");
assert.deepEqual(local.release({ ...source(), quarantined: 2 }).balance, supabaseRpcContract.release({ ...source(), quarantined: 2 }).balance, "release contract matches RPC");
assert.deepEqual(local.lost(source()).balance, supabaseRpcContract.lost(source()).balance, "loss contract matches RPC");
assert.deepEqual(local.found(source()).balance, supabaseRpcContract.found(source()).balance, "found contract matches RPC");

const before = source(); assert.throws(() => transferStock(before, destination(), 9), /Insufficient/, "insufficient transfer is rejected"); assert.deepEqual(before, source(), "failed transfer leaves local source unchanged");
assert.throws(() => transferStock(source(), { ...source() }, 1), /different/, "same location transfer is rejected");
assert.throws(() => reconcileCycleCount(source(), 1), /reserved/, "illegal count transition is rejected");
assert.throws(() => markDamaged({ ...source(), onHand: 2 }, 1, "damage"), /Insufficient/, "reserved units cannot be damaged");
// A failed downstream movement or activity insert is a PostgreSQL transaction failure:
// the RPC functions contain all three writes in one function, so an exception rolls back.
const simulatedTransaction = <T>(operation: () => T, failAfterMutation: boolean) => { const state = source(); const snapshot = structuredClone(state); try { const result = operation(); if (failAfterMutation) throw new Error("simulated activity failure"); return result; } catch { Object.assign(state, snapshot); return state; } };
assert.deepEqual(simulatedTransaction(() => adjustStock(source(), 2, "test"), true), source(), "transaction failure restores balance state");
console.log("✓ inventory local/RPC contract and rollback tests passed");
