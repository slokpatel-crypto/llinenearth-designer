import test from "node:test";
import assert from "node:assert/strict";
import { canTransitionOrder, canTransitionQuote } from "../src/lib/designer/production-state.ts";

test("production order cannot skip directly from created to delivered",()=>{
  assert.equal(canTransitionOrder("created","delivered"),false);
  assert.equal(canTransitionOrder("created","cloth_reserved"),true);
});

test("fitting may return to stitching for alteration or advance to ready",()=>{
  assert.equal(canTransitionOrder("fitting","stitching"),true);
  assert.equal(canTransitionOrder("fitting","ready"),true);
});

test("delivered and cancelled orders are terminal",()=>{
  assert.equal(canTransitionOrder("delivered","ready"),false);
  assert.equal(canTransitionOrder("cancelled","created"),false);
});

test("quote must be sent before acceptance and accepted quote is terminal",()=>{
  assert.equal(canTransitionQuote("draft","accepted"),false);
  assert.equal(canTransitionQuote("draft","sent"),true);
  assert.equal(canTransitionQuote("sent","accepted"),true);
  assert.equal(canTransitionQuote("accepted","void"),false);
});
