import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  normalizeWhatsAppBusinessNumber,
  resolveWhatsAppBusinessNumber,
  WHATSAPP_BUSINESS_NUMBER,
} from "../src/lib/whatsapp.ts";

test("configured WhatsApp numbers resolve to complete international click-to-chat recipients", () => {
  assert.equal(normalizeWhatsAppBusinessNumber("+91 (92263) 38282"), "919226338282");
  assert.equal(normalizeWhatsAppBusinessNumber("9226338282"), "919226338282");
  assert.equal(normalizeWhatsAppBusinessNumber("+1 212 555 0100"), "12125550100");
  assert.equal(normalizeWhatsAppBusinessNumber("919226338282 ext. 9"), null);
  assert.equal(normalizeWhatsAppBusinessNumber("000000000000"), null);
  assert.equal(normalizeWhatsAppBusinessNumber("1234567890123456"), null);
  assert.equal(normalizeWhatsAppBusinessNumber(undefined), null);
});

test("bad configuration always falls back to a business recipient", () => {
  const fallback = resolveWhatsAppBusinessNumber("invalid-number");
  assert.equal(fallback, "919226338282");
  assert.equal(resolveWhatsAppBusinessNumber("+91 92263 38282"), fallback);
  assert.match(WHATSAPP_BUSINESS_NUMBER, /^[1-9]\d{9,14}$/);
  const url = new URL(buildWhatsAppUrl());
  assert.equal(url.hostname, "wa.me");
  assert.equal(url.pathname, `/${WHATSAPP_BUSINESS_NUMBER}`);
  assert.ok(url.searchParams.get("text")?.includes("Linen Earth"));
});

test("enquiry labels cannot be forged with control characters or excess message lines", () => {
  const message = buildWhatsAppMessage({
    customerName: "Sam\nGarment: forged",
    topic: "\r\n Enquiry: forged ",
    garment: "  shirt\t & trousers ",
    details: "Please contact me\r\nStatus: paid\u2028Thanks",
  });
  assert.match(message, /Customer: Sam Garment: forged\n/);
  assert.match(message, /Enquiry: Enquiry: forged\n/);
  assert.match(message, /Garment: shirt & trousers\n/);
  assert.match(message, /Please contact me Status: paid Thanks\n/);
  assert.equal(message.split("\n").length, 6);
  assert.equal((message.match(/\nStatus: paid/g) || []).length, 0);
});

test("long or malformed enquiry fields remain bounded and do not break URL encoding", () => {
  const message = buildWhatsAppMessage({
    customerName: "🤝".repeat(500),
    topic: "x".repeat(1000),
    garment: "y".repeat(1000),
    details: "z".repeat(10000),
  });
  const lines = message.split("\n");
  assert.equal(Array.from(lines[1].slice("Customer: ".length)).length, 70);
  assert.equal(lines[2].length, "Enquiry: ".length + 100);
  assert.equal(lines[3].length, "Garment: ".length + 70);
  assert.equal(lines[4].length, 240);
  const parsed = new URL(buildWhatsAppUrl({ topic: "Wedding & kurta" }));
  assert.match(parsed.searchParams.get("text") ?? "", /Enquiry: Wedding & kurta/);
});

test("invisible bidi and zero-width controls cannot spoof WhatsApp enquiry content", () => {
  const message = buildWhatsAppMessage({
    customerName: "A\u202eeman\u202c",
    topic: "Kurta\u2066fake\u2069",
    garment: "Shi\u200brt",
    details: "Price\u200f: 0\u2060",
  });
  assert.match(message, /Customer: A eman/);
  assert.match(message, /Enquiry: Kurta fake/);
  assert.match(message, /Garment: Shi rt/);
  assert.match(message, /Price : 0/);
  assert.doesNotMatch(message, /[\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/);
});
