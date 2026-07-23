import assert from "node:assert/strict";
import { test } from "node:test";
import { serverTimingHeader } from "../lib/performance";

test("performance server timing header separates named durations", () => {
  const header = serverTimingHeader([
    { label: "parse json", durationMs: 4.2 },
    { label: "database", durationMs: 83 },
    { label: "bad, label", durationMs: 12.5 },
  ]);

  assert.equal(header, "parse_json;dur=4.2, database;dur=83, bad__label;dur=12.5");
});

