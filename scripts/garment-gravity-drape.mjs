/**
 * Deterministic low-amplitude, construction-guide-safe garment surface folds.
 *
 * These are geometric *preview* cues, not simulated cloth, measured garment
 * weight, fabric elasticity, or a replacement for real tailor photographs.
 * Real PBR fabric tiles retain independent physical UV repeat measurements.
 */
const clamp01=value=>Math.min(1,Math.max(0,value));
const smooth01=value=>{const t=clamp01(value);return t*t*(3-2*t);};

/**
 * Preview officewear sleeve silhouette, not measured tailor ease. Preserve
 * the full-width shoulder above 1.260 m while tapering up to 10.5% at the
 * 0.925 m wrist; matching anatomy and cuffs still needs fit evidence.
 */
export function studioSleeveRadiusScale(heightM){
  if(!Number.isFinite(heightM))throw new Error("Sleeve height must be finite.");
  return 1-.105*(1-smooth01((heightM-.925)/.335));
}

const PARTS={
  shirt:{bottom:1.055,top:1.465,amplitudeMm:4.0,sideMm:1.1},
  sleeve:{bottom:.883,top:1.455,amplitudeMm:3.0,sideMm:.7},
  leg:{bottom:.06002,top:.98498,amplitudeMm:5.5,sideMm:1.6},
};

/**
 * p and centre in metres, +Y points up. Displacement is constrained to
 * 0 at upper/lower tailoring rings and projects OUTWARD only, to avoid
 * deliberately pushing preview cloth through its anatomical body.
 */
export function garmentGravityFoldDisplacement(part,p,centerX=0,depthCenter=.015){
  const info=PARTS[part];
  if(!info) throw new Error("Unknown garment fold panel: "+part);
  if(![p.x,p.y,p.z,centerX,depthCenter].every(Number.isFinite))
    throw new Error("Garment fold input must have finite coordinates.");
  const t=clamp01((p.y-info.bottom)/(info.top-info.bottom));
  if(t<=0||t>=1) return {x:0,z:0};
  const guideFade=smooth01(Math.min(t,1-t)*8);
  const front=p.z>=depthCenter;
  const localX=p.x-centerX;
  const localZ=p.z-depthCenter;
  // Dominant vertical linen folds: loosely gathered lower shirt, elbow
  // wrinkles, and a front-pressed leg with extra accumulation near the shoe.
  let relief;
  let amplitude=info.amplitudeMm*.001*guideFade;
  if(part==="shirt"){
    const towardsHem=1-smooth01((t-.10)/.78);
    amplitude*=.40+.60*towardsHem;
    relief=.52+.28*Math.sin(localX*31+.60*Math.sin(t*8))
      +.20*Math.sin(localX*59-t*4);
  }else if(part==="sleeve"){
    const elbow=Math.exp(-Math.pow((t-.46)/.24,2));
    amplitude*=.27+.73*elbow;
    relief=.51+.31*Math.sin(localX*43+t*13)
      +.18*Math.sin(t*25-localX*29);
  }else{
    const nearShoe=1-smooth01((t-.12)/.48);
    amplitude*=.42+.58*nearShoe;
    const verticalPress=Math.cos(localX*43+.18*Math.sin(t*14));
    const shoeBreak=Math.sin(t*31+localX*24);
    relief=.50+.26*verticalPress+.24*shoeBreak;
  }
  relief=clamp01(relief);
  // The folds are positive skin-outwards displacement in radial X/Z,
  // anchored at unchanged source cloth guides. No body, hand or face change.
  const frontBias=front?1:.70;
  const zDirection=localZ>=0?1:-1;
  const sideRatio=clamp01(Math.abs(localX)/(part==="leg"?.081:part==="sleeve"?.059:.165));
  return {
    x:Math.sign(localX)*info.sideMm*.001*guideFade*relief*sideRatio,
    z:zDirection*amplitude*relief*frontBias,
  };
}
