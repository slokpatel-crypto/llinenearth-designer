/**
 * Saved concepts can come from old browser sessions, user edits, extensions,
 * and partially-written storage. Validate the fields consumed by Saved Designs
 * and the Atelier handoff before rendering or attempting to save a new entry.
 * This is structural recovery only; it cannot recover unsaved lost data.
 */
export function validStoredSavedDesigns<T>(value:unknown,limit=24):T[] {
  if(!Array.isArray(value)) return [];
  const record=(v:unknown):v is Record<string,unknown>=>v!==null && typeof v==="object" && !Array.isArray(v);
  const text=(v:unknown):v is string=>typeof v==="string";
  const named=(v:unknown):v is string=>text(v) && Boolean(v.trim());
  const stringArray=(v:unknown):v is string[]=>Array.isArray(v) && v.every(text);
  const contextFields=["occasion","venue","time","environment","formality","impression","fit","aesthetic"];
  const garmentFields=["shirt","trouser","layer","footwear"];
  return value.filter((candidate):candidate is T=>{
    if(!record(candidate) || !named(candidate.id) || !named(candidate.title) || !named(candidate.savedAt)) return false;
    const {brief,version,renderSet}=candidate;
    if(!record(brief) || !record(brief.context) ||
      !contextFields.every((field)=>text((brief.context as Record<string,unknown>)[field]))) return false;
    if(!record(brief.fabric) || !record(brief.fabric.profile)) return false;
    const profile=brief.fabric.profile as Record<string,unknown>;
    if(!stringArray(profile.palette) || !Array.isArray(profile.observations) ||
      !profile.observations.every((v)=>record(v) && text(v.label) && text(v.value))) return false;
    if(!record(version) || !named(version.id) || !record(version.candidate)) return false;
    const candidateDesign=version.candidate as Record<string,unknown>;
    if(!record(candidateDesign.garments) ||
      !garmentFields.every((field)=>text((candidateDesign.garments as Record<string,unknown>)[field])) ||
      !stringArray(candidateDesign.palette) || !text(candidateDesign.aesthetic) || !text(candidateDesign.concept)) return false;
    if(version.specHash!==undefined && !text(version.specHash)) return false;
    if(!record(renderSet) || !named(renderSet.modelId) || !Array.isArray(renderSet.renders)) return false;
    if(!renderSet.renders.some((render)=>record(render) && text(render.src) && text(render.view)) ||
      !renderSet.renders.every((render)=>record(render) && text(render.src) && text(render.view))) return false;
    if(!record(renderSet.spec) || !record(renderSet.spec.fabric) ||
      !text((renderSet.spec.fabric as Record<string,unknown>).material)) return false;
    return true;
  }).slice(0,limit);
}
