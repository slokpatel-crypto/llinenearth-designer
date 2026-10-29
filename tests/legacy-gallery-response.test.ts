import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAX_LEGACY_GALLERY_HTML_BYTES, readBoundedLegacyGalleryHtml } from "../src/lib/legacy-gallery-response.ts";

test("legacy gallery loader handles valid and absent HTML safely",async()=>{
  assert.equal(await readBoundedLegacyGalleryHtml(new Response("<p>Linen &amp; cotton</p>")),"<p>Linen &amp; cotton</p>");
  assert.equal(await readBoundedLegacyGalleryHtml(new Response(null)),"");
  const unicode="<span>कपड़ा</span>";
  assert.equal(await readBoundedLegacyGalleryHtml(new Response(unicode)),unicode);
});

test("declared and streamed oversized gallery responses are rejected, not partially accepted",async()=>{
  await assert.rejects(readBoundedLegacyGalleryHtml(new Response("small",{
    headers:{"content-length":String(MAX_LEGACY_GALLERY_HTML_BYTES+1)},
  })),/size limit/i);
  // No Content-Length: the streaming bound must still reject untrusted HTML.
  await assert.rejects(readBoundedLegacyGalleryHtml(new Response("x".repeat(MAX_LEGACY_GALLERY_HTML_BYTES+1))),/size limit/i);
  await assert.rejects(readBoundedLegacyGalleryHtml(new Response("é".repeat(Math.ceil(MAX_LEGACY_GALLERY_HTML_BYTES/2)+1))),/size limit/i);
  assert.equal((await readBoundedLegacyGalleryHtml(new Response("y".repeat(1024)))).length,1024);
});

test("optional old-site scans are time-bounded before verified inventory is returned",()=>{
  const source=readFileSync(new URL("../src/lib/legacy-site-inventory.ts",import.meta.url),"utf8");
  assert.match(source,/readBoundedLegacyGalleryHtml\(response\)/);
  assert.match(source,/signal: AbortSignal\.timeout\(5_000\)/);
  assert.match(source,/cache: "no-store"/);
  assert.match(source,/catch \(error\)/);
});
