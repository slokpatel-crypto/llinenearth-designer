import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
import { BRAND_LOGO_SRC, BRAND_LOGO_SIZE } from "../src/lib/brand-logo-data.ts";

const asset = new URL(`../public${BRAND_LOGO_SRC}`, import.meta.url);

test("the customer logo fully decodes with its declared intrinsic dimensions", async () => {
  const bytes = await readFile(asset);
  // Metadata alone accepted the old corrupt PNG. Decode every pixel so CRC
  // errors or a truncated image stream cannot masquerade as a working logo.
  const { data, info } = await sharp(bytes, { failOn: "warning" }).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, BRAND_LOGO_SIZE.width);
  assert.equal(info.height, BRAND_LOGO_SIZE.height);
  assert.equal(data.length, info.width * info.height * info.channels);
});

test("the logo URL identifies its exact bytes instead of reusing a corrupt cached URL", async () => {
  const bytes = await readFile(asset);
  const hash = createHash("sha256").update(bytes).digest("hex");
  assert.equal(BRAND_LOGO_SRC, `/brand/linen-earth-logo-${hash.slice(0, 12)}.png`);
});
