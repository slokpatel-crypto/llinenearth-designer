import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

test("default homepage renders the immutable original Studio photo without per-visit paid FASHN calls",()=>{
  const page=readFileSync("src/app/page.tsx","utf8");
  const release=readFileSync("scripts/release-readiness.mjs","utf8");
  assert.match(page,/<img src="\/designer\/studio-tucked\.webp" alt="Linen Earth original fixed Studio model preview"/);
  assert.doesNotMatch(page,/<img src="\/api\/homepage-model"/);
  assert.match(release,/requireTokens\("src\/app\/page\.tsx", \["\/designer\/studio-tucked\.webp"/);
  assert.doesNotMatch(release,/requireTokens\("src\/app\/page\.tsx", \["\/api\/homepage-model"/);
  assert.match(release,/Optional FASHN is not configured; canonical Studio homepage needs no paid render/);
  assert.doesNotMatch(release,/if \(!health\?\.configured\) fail\("FASHN_API_KEY is not configured/);
});

test("opt-in provider endpoint stays compatible and falls back to the canonical photo",()=>{
  const route=readFileSync("src/app/api/homepage-model/route.ts","utf8");
  assert.match(route,/const FALLBACK = "\/designer\/studio-tucked\.webp"/);
  assert.match(route,/url\.searchParams\.get\("status"\) === "1"/);
  assert.match(route,/if \(!apiKey\) return fallback/);
  assert.match(route,/new Fashn\(\{ apiKey/);
  const page=readFileSync("src/app/page.tsx","utf8");
  assert.match(page,/href="\/real-model"/);
  assert.match(page,/href="\/style-director"/);
});
