import test from "node:test";
import assert from "node:assert/strict";
import { selectedLookRenderCacheKey } from "../src/lib/designer/render-cache-key.ts";

const base={
  shirt:{id:"shirt-a"},
  pant:{id:"pant-b"},
  style:{collar:"Spread",shirtWear:"Tucked"},
  styleSpec:{styleSchemaVersion:2,shirt:{collar:"spread"},pant:{fit:"straight"}},
  bodyProfile:{version:1,build:"regular",heightCm:178,skinTone:"medium",source:"default"},
  renderEvidence:{shirt:{repeatMm:12},pant:{repeatMm:null}},
};

test("final render cache key is deterministic across object key order",()=>{
  const a=selectedLookRenderCacheKey(base,"front");
  const b=selectedLookRenderCacheKey({
    ...base,
    style:{shirtWear:"Tucked",collar:"Spread"},
  },"front");
  assert.equal(a,b);
});

test("alternate view cache is tied to the approved front render identity",()=>{
  const a=selectedLookRenderCacheKey(base,"back","https://cdn.fashn.ai/jobs/abc.png?token=one");
  const b=selectedLookRenderCacheKey(base,"back","https://cdn.fashn.ai/jobs/abc.png?token=two");
  const c=selectedLookRenderCacheKey(base,"back","https://cdn.fashn.ai/jobs/xyz.png");
  assert.equal(a,b);
  assert.notEqual(a,c);
});

test("fabric construction or body changes invalidate final render cache",()=>{
  const baseline=selectedLookRenderCacheKey(base,"front");
  assert.notEqual(baseline,selectedLookRenderCacheKey({...base,shirt:{id:"shirt-c"}},"front"));
  assert.notEqual(baseline,selectedLookRenderCacheKey({...base,bodyProfile:{...base.bodyProfile,heightCm:190}},"front"));
  assert.notEqual(baseline,selectedLookRenderCacheKey({...base,styleSpec:{...base.styleSpec,pant:{fit:"korean_wide"}}},"front"));
});


test("cache ignores non-render body provenance and measurement-quality bookkeeping",()=>{
  const withSilhouette={
    ...base,
    bodyProfile:{
      ...base.bodyProfile,
      source:"measurements",
      silhouette:{
        shoulderScale:1.04,chestScale:1.06,waistScale:.98,seatScale:1.02,thighScale:1.03,legLengthScale:1.01,evidenceCount:6,
      },
    },
    renderEvidence:{
      shirt:{repeatMm:12,measurementQuality:82,measuredColorHex:"#8899AA"},
      pant:{repeatMm:null,measurementQuality:91,measuredColorHex:"#776655"},
    },
  };
  const baseline=selectedLookRenderCacheKey(withSilhouette,"front");
  assert.equal(
    baseline,
    selectedLookRenderCacheKey({
      ...withSilhouette,
      bodyProfile:{
        ...withSilhouette.bodyProfile,
        source:"manual",
        silhouette:{...withSilhouette.bodyProfile.silhouette,evidenceCount:4},
      },
      renderEvidence:{
        shirt:{repeatMm:12,measurementQuality:96,measuredColorHex:"#8899AA"},
        pant:{repeatMm:null,measurementQuality:76,measuredColorHex:"#776655"},
      },
    },"front"),
  );
  assert.notEqual(
    baseline,
    selectedLookRenderCacheKey({
      ...withSilhouette,
      bodyProfile:{
        ...withSilhouette.bodyProfile,
        silhouette:{...withSilhouette.bodyProfile.silhouette,waistScale:1.08},
      },
    },"front"),
  );
  assert.notEqual(
    baseline,
    selectedLookRenderCacheKey({
      ...withSilhouette,
      renderEvidence:{
        ...withSilhouette.renderEvidence,
        shirt:{...withSilhouette.renderEvidence.shirt,measuredColorHex:"#AABBCC"},
      },
    },"front"),
  );
});
