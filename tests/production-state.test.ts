import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
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

test("Production Desk only exposes Void for states permitted by shared and SQL transitions",()=>{
  assert.equal(canTransitionQuote("draft","void"),true);
  assert.equal(canTransitionQuote("sent","void"),true);
  assert.equal(canTransitionQuote("accepted","void"),false);
  assert.equal(canTransitionQuote("void","void"),false);
  const ui=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  assert.match(ui,/canTransitionQuote\(item.status as ProductionQuoteStatus,"void"\)&&<button/);
  assert.doesNotMatch(ui,/item.status!=="void"&&<button[^\n]*Quote voided/);
  assert.equal((ui.match(/canTransitionQuote\(item.status as ProductionQuoteStatus,"void"\)/g)||[]).length,1);
  const migration=readFileSync("supabase/migrations/20261001_production_quotes_orders.sql","utf8");
  const fn=migration.split("function public.production_quote_set_status(")[1]?.split("create or replace function public.production_quote_list(")[0]||"";
  assert.match(fn,/\(v_current='draft' and p_status in \('sent','void'\)\)/);
  assert.match(fn,/\(v_current='sent' and p_status in \('accepted','void'\)\)/);
  assert.doesNotMatch(fn,/v_current='accepted' and p_status='void'/);
});
