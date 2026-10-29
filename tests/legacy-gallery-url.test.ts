import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sameOriginLegacyGalleryUrl } from "../src/lib/legacy-gallery-url.ts";

const page="https://llinenearth.com/60lea-plain.php";

test("same-origin legacy gallery accepts existing HTTPS swatches and relative links",()=>{
  for(const [input,expected] of [
    ["/products/60lea-plain/IMG_5369.JPG","https://llinenearth.com/products/60lea-plain/IMG_5369.JPG"],
    ["products/IMG_5369.JPG","https://llinenearth.com/products/IMG_5369.JPG"],
    ["https://llinenearth.com/linen-suiting.php","https://llinenearth.com/linen-suiting.php"],
    ["//llinenearth.com/products/IMG_5369.JPG","https://llinenearth.com/products/IMG_5369.JPG"],
  ]) assert.equal(sameOriginLegacyGalleryUrl(input,page),expected);
});

test("lookalike domains, off-origin images, credentials and unsafe schemes are rejected",()=>{
  for(const input of [
    "https://llinenearth.com.evil.example/track.jpg",
    "https://llinenearth.com@evil.example/track.jpg",
    "https://evil.example/track.jpg",
    "//evil.example/track.jpg",
    "https://user:password@llinenearth.com/private.jpg",
    "http://llinenearth.com/insecure.jpg",
    "javascript:alert(1)",
    "data:image/svg+xml,<svg/>",
    "file:///etc/passwd",
    "ftp://llinenearth.com/pic.jpg",
    "not-a-valid-host:whatever",
    42,{},null,
  ]) assert.equal(sameOriginLegacyGalleryUrl(input,page),null,JSON.stringify(input));
  assert.equal(sameOriginLegacyGalleryUrl("/image.jpg","http://llinenearth.com/page"),null);
});

test("both discovered image and link URLs use the same exact-origin guard",()=>{
  const source=readFileSync(new URL("../src/lib/legacy-site-inventory.ts",import.meta.url),"utf8");
  assert.match(source,/const src = sameOriginLegacyGalleryUrl\(raw, pageUrl\)/);
  assert.match(source,/const href = sameOriginLegacyGalleryUrl\(match\[1\], pageUrl\)/);
  assert.doesNotMatch(source,/href\.startsWith\(BASE\)/);
  assert.doesNotMatch(source,/absoluteUrl\(/);
  assert.match(source,/inStock: false/);
});
