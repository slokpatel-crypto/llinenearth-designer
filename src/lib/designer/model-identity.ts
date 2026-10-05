import identity from "../../../public/model-identity/linen-earth-studio-model-v1.json";

export type LinenEarthModelView="front"|"three-quarter"|"side"|"back";

export const LINEN_EARTH_MODEL_IDENTITY=identity;
export const LINEN_EARTH_MODEL_IDENTITY_ID=identity.version;
export const LINEN_EARTH_MODEL_REFERENCE_IMAGE=identity.referenceImage;
export const LINEN_EARTH_MODEL_REFERENCE_HEIGHT_MM=identity.referenceHeightMm;
export const LINEN_EARTH_MODEL_VIEWS=identity.views as ReadonlyArray<{
  id:LinenEarthModelView;
  label:string;
  yawDeg:number;
  orbit:string;
}>;

export function linenEarthModelIdentityPrompt() {
  return [
    `Canonical model identity: ${LINEN_EARTH_MODEL_IDENTITY_ID}.`,
    `The reference model is the Linen Earth Real Model Designer studio mannequin from ${LINEN_EARTH_MODEL_REFERENCE_IMAGE}.`,
    "It is one fixed faceless mannequin, not a replaceable person or generic male model.",
    ...identity.identityRules.map((rule)=>`Preserve ${rule}.`),
  ].join(" ");
}

export function linenEarthViewPrompt(view:LinenEarthModelView) {
  const target=LINEN_EARTH_MODEL_VIEWS.find((item)=>item.id===view)!;
  return `Camera identity target: ${target.label}, yaw ${target.yawDeg} degrees. Rotate only the locked mannequin/camera relationship needed for this view; do not morph the body between views.`;
}
