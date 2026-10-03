import { DESIGNER_STYLE_CHOICES, type DesignerStyle } from "./engine.ts";
import type { ParsedDesignerBrief } from "./brief.ts";
import { parseDesignerConstructionIntent } from "./construction-intent.ts";
import { compileDesignerIntent, designGoalPatch, scopeStyleLocks } from "./design-intent.ts";
import type { LocalDesignerTasteProfile } from "./taste-profile.ts";

/** Personal browser preferences are advisory. They never certify fabric facts,
 * override the current task, or become production / global learning evidence. */
export function safePersonalTaste(value:unknown):LocalDesignerTasteProfile|null {
  if(!value || typeof value!=="object" || Array.isArray(value)) return null;
  const v=value as Record<string,unknown>;
  if(v.version!==1) return null;
  const evidence=Number.isFinite(v.evidence)?Math.max(0,Math.min(240,Math.floor(v.evidence as number))):0;
  const profile:LocalDesignerTasteProfile={version:1,evidence};
  if(evidence<4) return profile;
  if(["Safe","Elevated","Statement"].includes(String(v.preferredTier))) profile.preferredTier=v.preferredTier as LocalDesignerTasteProfile["preferredTier"];
  if(["Tucked","Untucked"].includes(String(v.preferredShirtWear))) profile.preferredShirtWear=v.preferredShirtWear as LocalDesignerTasteProfile["preferredShirtWear"];
  if(typeof v.preferredTrouser==="string" && DESIGNER_STYLE_CHOICES.trouser.includes(v.preferredTrouser)) profile.preferredTrouser=v.preferredTrouser;
  const raw=v.preferredConstruction;
  if(raw && typeof raw==="object" && !Array.isArray(raw)) {
    const construction:Partial<DesignerStyle>={};
    for(const [key,choices] of Object.entries(DESIGNER_STYLE_CHOICES)) {
      const candidate=(raw as Record<string,unknown>)[key];
      if(typeof candidate==="string" && choices.includes(candidate)) construction[key as keyof DesignerStyle]=candidate;
    }
    if(Object.keys(construction).length) profile.preferredConstruction=construction;
  }
  return profile;
}

export function personalizeDesignerBrief(parsed:ParsedDesignerBrief,taste:LocalDesignerTasteProfile|null) {
  if(!taste || taste.evidence<4) return parsed;
  const intent=compileDesignerIntent(parsed.original),construction=parseDesignerConstructionIntent(parsed.original);
  const protectedKeys=new Set([...Object.keys(construction.patch),...Object.keys(construction.excluded),...Object.keys(designGoalPatch(intent,parsed.occasion)),...Object.keys(scopeStyleLocks(intent.scope,parsed.style))]);
  const text=parsed.original.toLowerCase();
  for(const [key,noun] of Object.entries({collar:"collar",collarFinish:"collar finish",cuff:"cuffs?",placket:"placket",shirtFit:"(?:shirt )?fit",shirtWear:"(?:shirt )?wear",trouser:"trouser (?:shape|cut)",rise:"rise",waistband:"waistband",break:"break",button:"buttons?"})) {
    if(new RegExp("\\b(?:keep|preserve|do not change|don't change)\\s+(?:(?:my|the|current|selected)\\s+)*"+noun+"\\b","i").test(text)) protectedKeys.add(key);
  }
  const learned={...(taste.preferredShirtWear?{shirtWear:taste.preferredShirtWear}:{}),...(taste.preferredTrouser?{trouser:taste.preferredTrouser}:{}),...taste.preferredConstruction};
  const style={...parsed.style},personalStylePatch:Partial<DesignerStyle>={},preference={...parsed.preference},notes:string[]=[];
  for(const [key,value] of Object.entries(learned) as Array<[keyof DesignerStyle,string]>) {
    if(protectedKeys.has(key) || !DESIGNER_STYLE_CHOICES[key].includes(value)) continue;
    style[key]=value;personalStylePatch[key]=value;notes.push(value);
  }
  const explicitEnergy=/\b(?:quiet|understated|minimal|subtle|bold|statement|expressive|stand out|standout|not boring|creative|distinctive|balanced)\b/.test(text);
  if(taste.preferredTier && !explicitEnergy) {preference.preferredTier=taste.preferredTier;notes.push(taste.preferredTier.toLowerCase()+" energy");}
  const interpretation=[...parsed.interpretation];
  if(notes.length) interpretation.push("Personal preferences from your distinct judgements: "+notes.join(", ")+". Current instructions and compatibility checks take priority.");
  return {...parsed,style,preference,interpretation,personalStylePatch};
}
