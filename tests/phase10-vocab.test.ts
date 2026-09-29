import test from "node:test";
import assert from "node:assert/strict";
import { normalizeToken, normalizeArray } from "../src/lib/vocab/normalization.ts";
import { colorFamilies } from "../src/lib/vocab/colors.ts";
import { colorFamilyPairSignal } from "../src/lib/vocab/intelligence.ts";
import { adaptFabricProfileToV4 } from "../src/lib/fabric-intelligence-adapter.ts";

test("exact color-family pairing never treats teal as blue",()=>{
  assert.equal(colorFamilyPairSignal([],["blue_family"],"blue_family"),-1);
  assert.equal(colorFamilyPairSignal([],["blue_family"],"teal_family"),0);
  assert.equal(colorFamilyPairSignal(["blue_family"],[],"blue_family"),1);
});

test("unknown vocabulary is dropped and reported",()=>{
  const one=normalizeToken("electric peacock",colorFamilies);
  assert.equal(one.value,null);
  assert.deepEqual(one.reviewNeeded,["electric peacock"]);
  const many=normalizeArray(["Blue","electric peacock","teal"],colorFamilies);
  assert.deepEqual(many.values,["blue_family","teal_family"]);
  assert.deepEqual(many.reviewNeeded,["electric peacock"]);
});

test("v3 analyzer rows adapt to v4 without substring guessing",()=>{
  const v3={
    version:"fabric-analyzer-v3",
    observed:{
      dominantColor:"Navy",
      colorFamily:"Blue",
      undertone:"cool",
      depth:"deep",
      saturation:"medium",
      secondaryColors:["White"],
      patternFamily:"stripe",
      patternScale:"fine",
      patternDensity:"balanced",
      patternContrast:"medium",
      orientation:"vertical",
      visibleTexture:["smooth-looking"],
      weaveAppearance:["poplin-like"],
      sheen:"low",
      visualWeight:"light-looking",
    },
    inferredStyle:{
      personality:["business"],
      formality:4,
      statementLevel:2,
      bestGarments:["shirt"],
      bestOccasions:["business formal","office"],
      climateVisualFit:["air-conditioned"],
      recommendedConstruction:{
        collars:["Spread Collar"],
        cuffs:["Barrel Cuff (2-button)"],
        shirtFits:["Regular / Classic Fit"],
        trouserDirections:["Formal Trouser (Flat-front)"],
      },
      pairing:{
        goodColorFamilies:["white","grey"],
        avoidColorFamilies:["red"],
        goodPatternStrategy:["solid support","fine scale"],
      },
    },
    confidence:{color:.9,pattern:.88,texture:.7,styling:.8},
    evidence:{verifiedFacts:[],visualObservations:["fine stripe"],uncertainClaims:[]},
    references:{materialTerms:["poplin"],patternTerms:["pinstripe"],colorTerms:["navy"],sourceIds:["thomas-mason"]},
    summary:"Legacy row",
  };
  const adapted=adaptFabricProfileToV4(v3);
  assert(adapted);
  assert.equal(adapted.version,"fabric-analyzer-v4");
  assert.equal(adapted.observed.colorFamily,"blue_family");
  assert.deepEqual(adapted.inferredStyle.bestGarments,["shirt"]);
  assert(adapted.inferredStyle.bestOccasions.includes("boardroom_business_formal"));
  assert(adapted.inferredStyle.recommendedConstruction.collars.includes("spread_collar"));
  assert(adapted.inferredStyle.recommendedConstruction.cuffs.includes("barrel_cuff_2_button"));
  assert(adapted.inferredStyle.recommendedConstruction.shirtFits.includes("regular_classic_fit"));
  assert(adapted.inferredStyle.recommendedConstruction.trouserDirections.includes("formal_flat_front"));
  assert(adapted.inferredStyle.pairing.goodColorFamilies.includes("white_family"));
  assert(adapted.inferredStyle.pairing.goodColorFamilies.includes("neutral_cool"));
  assert(adapted.inferredStyle.pairing.avoidColorFamilies.includes("red_family"));
  assert.deepEqual(adapted.reviewNeeded,[]);
});
