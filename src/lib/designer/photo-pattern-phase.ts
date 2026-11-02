/** Screen-space canvas transform only. This is neither measured repeat scale nor cutting grain. */
export type PhotoPatternPoint={x:number;y:number};
export type PhotoPatternMatrix={a:number;b:number;c:number;d:number;e:number;f:number};

/**
 * Apply a photographed panel's fall to a common fabric-tile coordinate system.
 * Both panels sample exactly the same textile pixel at their shared seam point,
 * regardless of swatch rotation, tile scale, or panel grain angle. A single
 * seam point can be phase matched; an angled sewn seam is NOT a claim that
 * every printed stripe or check is physically pattern-matched along its length.
 */
export function phaseLockedPhotoPatternMatrix(input:{
  scale:number;
  fabricRotationDeg:number;
  panelRotationDeg:number;
  phaseOrigin:PhotoPatternPoint;
  seam:PhotoPatternPoint;
}):PhotoPatternMatrix {
  const {scale,fabricRotationDeg,panelRotationDeg,phaseOrigin,seam}=input;
  if(![scale,fabricRotationDeg,panelRotationDeg,phaseOrigin.x,phaseOrigin.y,seam.x,seam.y]
    .every(Number.isFinite) || scale<=0) throw new RangeError("Invalid photographic fabric pattern transform");
  const base=fabricRotationDeg*Math.PI/180,panel=panelRotationDeg*Math.PI/180;
  const c0=Math.cos(base)*scale,s0=Math.sin(base)*scale;
  // Shared scale and fabric orientation around a canonical garment reference.
  const e0=phaseOrigin.x-c0*phaseOrigin.x+s0*phaseOrigin.y;
  const f0=phaseOrigin.y-s0*phaseOrigin.x-c0*phaseOrigin.y;
  const cp=Math.cos(panel),sp=Math.sin(panel);
  // Rotating about the seam cannot change which fabric pixel is sampled there.
  return {
    a:cp*c0-sp*s0,
    b:sp*c0+cp*s0,
    c:-cp*s0-sp*c0,
    d:-sp*s0+cp*c0,
    e:seam.x+cp*(e0-seam.x)-sp*(f0-seam.y),
    f:seam.y+sp*(e0-seam.x)+cp*(f0-seam.y),
  };
}
