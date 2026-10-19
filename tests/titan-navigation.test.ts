import assert from "node:assert/strict";
import test from "node:test";
import { titanDevelopmentTrack, titanJourneys, titanQuickLinks } from "../src/lib/titan/navigation.ts";

const maintainedRoutes = new Set([
  "/designer-studio",
  "/style-director",
  "/measurements",
  "/account",
]);

test("TITAN navigation only advertises existing customer workflows", () => {
  assert.equal(titanJourneys.length, 3);
  assert.equal(new Set(titanJourneys.map((journey) => journey.id)).size, titanJourneys.length);
  assert.equal(new Set(titanJourneys.map((journey) => journey.href)).size, titanJourneys.length);
  for (const journey of titanJourneys) {
    assert.ok(maintainedRoutes.has(journey.href), `Unsupported destination: ${journey.href}`);
    assert.ok(journey.action && journey.title && journey.description);
    assert.ok(journey.image.startsWith("/"));
    assert.ok(journey.imageAlt.length > 15, "Image must have meaningful alt text");
  }
});

test("TITAN quick links stay internal and do not introduce mock payment or AI services", () => {
  assert.equal(new Set(titanQuickLinks.map((link) => link.href)).size, titanQuickLinks.length);
  for (const link of titanQuickLinks) {
    assert.ok(maintainedRoutes.has(link.href), `Unsupported quick link: ${link.href}`);
    assert.ok(link.label.trim().length > 0);
  }
});

test("Unfinished fidelity and commerce work remain visible as development work", () => {
  assert.deepEqual(titanDevelopmentTrack.map((item) => item.id), ["model", "fabrics", "commerce"]);
  for (const item of titanDevelopmentTrack) {
    assert.ok(item.title.length > 0);
    assert.ok(item.description.length > 40);
    assert.match(item.description, /remain|require|must/i);
  }
});
