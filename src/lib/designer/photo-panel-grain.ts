export type PhotoPanelAxis={
  topX:number;
  topY:number;
  bottomX:number;
  bottomY:number;
};

export type PhotoPanelPoint={x:number;y:number};

/**
 * Returns the screen-space rotation, in degrees, needed to align a fabric's
 * vertical grain with a photographed panel axis. This is visual geometry from
 * the fixed studio photograph, not a claim about physical cloth measurements.
 */
export function photoPanelRotationFromVertical(axis:PhotoPanelAxis) {
  const dx=Number(axis.bottomX)-Number(axis.topX);
  const dy=Number(axis.bottomY)-Number(axis.topY);
  if(!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dy)<1) return 0;
  const degrees=Math.atan2(dx,dy)*180/Math.PI;
  return Math.round(degrees*10)/10;
}

// Approximate center-line anchors traced from the fixed 1024x1536 tucked
// photograph. They keep directional fabrics following the photographed sleeve
// and trouser fall instead of staying artificially vertical across every panel.
export const PHOTO_TUCKED_PANEL_AXES={
  leftSleeve:{topX:351,topY:244,bottomX:311,bottomY:680},
  rightSleeve:{topX:669,topY:244,bottomX:706,bottomY:680},
  leftTrouser:{topX:439,topY:542,bottomX:443,bottomY:1375},
  rightTrouser:{topX:580,topY:542,bottomX:615,bottomY:1361},
} as const satisfies Record<string,PhotoPanelAxis>;

export const PHOTO_TUCKED_PANEL_GRAIN_ROTATION={
  body:0,
  leftSleeve:photoPanelRotationFromVertical(PHOTO_TUCKED_PANEL_AXES.leftSleeve),
  rightSleeve:photoPanelRotationFromVertical(PHOTO_TUCKED_PANEL_AXES.rightSleeve),
  leftTrouser:photoPanelRotationFromVertical(PHOTO_TUCKED_PANEL_AXES.leftTrouser),
  rightTrouser:photoPanelRotationFromVertical(PHOTO_TUCKED_PANEL_AXES.rightTrouser),
  collar:90,
} as const;

/**
 * Pattern transforms rotate/scale around a photographed panel anchor rather
 * than the canvas origin. Anchoring near the seam/waist keeps stripe/check
 * phase visually stable when panel rotation or verified repeat scale changes.
 * These are screen-space layout anchors only, not tailoring or grain evidence.
 */
export const PHOTO_TUCKED_PANEL_PATTERN_ANCHOR={
  body:{x:510,y:244},
  leftSleeve:{x:PHOTO_TUCKED_PANEL_AXES.leftSleeve.topX,y:PHOTO_TUCKED_PANEL_AXES.leftSleeve.topY},
  rightSleeve:{x:PHOTO_TUCKED_PANEL_AXES.rightSleeve.topX,y:PHOTO_TUCKED_PANEL_AXES.rightSleeve.topY},
  leftTrouser:{x:PHOTO_TUCKED_PANEL_AXES.leftTrouser.topX,y:PHOTO_TUCKED_PANEL_AXES.leftTrouser.topY},
  rightTrouser:{x:PHOTO_TUCKED_PANEL_AXES.rightTrouser.topX,y:PHOTO_TUCKED_PANEL_AXES.rightTrouser.topY},
  collar:{x:512,y:214},
} as const satisfies Record<string,PhotoPanelPoint>;
