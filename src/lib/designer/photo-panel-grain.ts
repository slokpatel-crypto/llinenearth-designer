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

/**
 * The untucked studio shirt is a separate photograph. Split its torso, sleeves
 * and collar into independent texture panels so directional fabric follows the
 * photographed arm fall instead of remaining globally vertical across the body.
 */
export const PHOTO_UNTUCKED_SHIRT_PANEL_AXES={
  leftSleeve:{topX:351,topY:244,bottomX:311,bottomY:680},
  rightSleeve:{topX:669,topY:244,bottomX:706,bottomY:680},
} as const satisfies Record<string,PhotoPanelAxis>;

export const PHOTO_UNTUCKED_SHIRT_GRAIN_ROTATION={
  body:0,
  leftSleeve:photoPanelRotationFromVertical(PHOTO_UNTUCKED_SHIRT_PANEL_AXES.leftSleeve),
  rightSleeve:photoPanelRotationFromVertical(PHOTO_UNTUCKED_SHIRT_PANEL_AXES.rightSleeve),
  collar:90,
} as const;

export const PHOTO_UNTUCKED_SHIRT_PATTERN_ANCHOR={
  body:{x:510,y:244},
  leftSleeve:{x:PHOTO_UNTUCKED_SHIRT_PANEL_AXES.leftSleeve.topX,y:PHOTO_UNTUCKED_SHIRT_PANEL_AXES.leftSleeve.topY},
  rightSleeve:{x:PHOTO_UNTUCKED_SHIRT_PANEL_AXES.rightSleeve.topX,y:PHOTO_UNTUCKED_SHIRT_PANEL_AXES.rightSleeve.topY},
  collar:{x:512,y:214},
} as const satisfies Record<string,PhotoPanelPoint>;


export type UntuckedTrouserTemplate="pleated"|"wide";

/**
 * Screen-space centerline traces for the two older untucked trouser photos.
 * They are visual projection geometry only. The left/right values are taken
 * from the existing photographed trouser silhouettes and do not claim cutting
 * grain, drape physics or physical dimensions.
 */
export const PHOTO_UNTUCKED_TROUSER_PANEL_AXES={
  pleated:{
    leftTrouser:{topX:495,topY:758,bottomX:458,bottomY:1352},
    rightTrouser:{topX:511,topY:759,bottomX:562,bottomY:1354},
  },
  wide:{
    leftTrouser:{topX:497,topY:770,bottomX:479,bottomY:1353},
    rightTrouser:{topX:513,topY:774,bottomX:542,bottomY:1353},
  },
} as const satisfies Record<UntuckedTrouserTemplate,Record<"leftTrouser"|"rightTrouser",PhotoPanelAxis>>;

export const PHOTO_UNTUCKED_TROUSER_GRAIN_ROTATION={
  pleated:{
    leftTrouser:photoPanelRotationFromVertical(PHOTO_UNTUCKED_TROUSER_PANEL_AXES.pleated.leftTrouser),
    rightTrouser:photoPanelRotationFromVertical(PHOTO_UNTUCKED_TROUSER_PANEL_AXES.pleated.rightTrouser),
  },
  wide:{
    leftTrouser:photoPanelRotationFromVertical(PHOTO_UNTUCKED_TROUSER_PANEL_AXES.wide.leftTrouser),
    rightTrouser:photoPanelRotationFromVertical(PHOTO_UNTUCKED_TROUSER_PANEL_AXES.wide.rightTrouser),
  },
} as const;

export const PHOTO_UNTUCKED_TROUSER_PATTERN_ANCHOR={
  pleated:{
    leftTrouser:{x:PHOTO_UNTUCKED_TROUSER_PANEL_AXES.pleated.leftTrouser.topX,y:PHOTO_UNTUCKED_TROUSER_PANEL_AXES.pleated.leftTrouser.topY},
    rightTrouser:{x:PHOTO_UNTUCKED_TROUSER_PANEL_AXES.pleated.rightTrouser.topX,y:PHOTO_UNTUCKED_TROUSER_PANEL_AXES.pleated.rightTrouser.topY},
  },
  wide:{
    leftTrouser:{x:PHOTO_UNTUCKED_TROUSER_PANEL_AXES.wide.leftTrouser.topX,y:PHOTO_UNTUCKED_TROUSER_PANEL_AXES.wide.leftTrouser.topY},
    rightTrouser:{x:PHOTO_UNTUCKED_TROUSER_PANEL_AXES.wide.rightTrouser.topX,y:PHOTO_UNTUCKED_TROUSER_PANEL_AXES.wide.rightTrouser.topY},
  },
} as const satisfies Record<UntuckedTrouserTemplate,Record<"leftTrouser"|"rightTrouser",PhotoPanelPoint>>;
