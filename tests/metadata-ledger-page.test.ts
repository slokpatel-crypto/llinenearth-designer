import test from "node:test";
import assert from "node:assert/strict";
import { hasCompleteOperatorMetadataPage, OPERATOR_METADATA_PAGE_LIMIT } from "../src/lib/designer/metadata-ledger-page.ts";

test("complete PostgREST metadata histories are distinguishable from empty and truncated histories", () => {
  assert.equal(hasCompleteOperatorMetadataPage([], "*/0"), true);
  assert.equal(hasCompleteOperatorMetadataPage([{ at: "x" }], "0-0/1"), true);
  assert.equal(hasCompleteOperatorMetadataPage(Array.from({ length: 1000 }, (_, i) => i), "0-999/1000"), true);
  for (const [rows, range] of [
    [[], null], [[], "*/1"], [[], "0-0/0"],
    [[{ at: "x" }], null], [[{ at: "x" }], "0-0/*"],
    [[{ at: "x" }], "0-0/2"], [[{ at: "x" }], "1-1/1"],
    [[{ at: "x" }], "0-1/1"],
    [Array.from({ length: 1000 }, (_, i) => i), "0-999/1001"],
    [Array.from({ length: 1001 }, (_, i) => i), "0-1000/1001"],
    [null, "*/0"], [{ at: "x" }, "0-0/1"],
  ] as Array<[unknown, string | null]>) {
    assert.equal(hasCompleteOperatorMetadataPage(rows, range), false, String(range));
  }
  assert.equal(OPERATOR_METADATA_PAGE_LIMIT, 1000);
});
