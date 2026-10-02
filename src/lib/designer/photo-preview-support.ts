import type { DesignerStyle } from "./engine.ts";

export type PhotoPreviewSupportStatus="exact"|"approximate"|"none";
export type PhotoPreviewSupportDetail={
  status:PhotoPreviewSupportStatus;
  reason:string;
};

/**
 * Canonical customer-photo support for legacy Designer choices.
 * This describes the photographed compositor, not the internal construction
 * drawing and not final-AI capability. "Exact" means the visible cut/detail is
 * represented by a matching photographed template or mask. "Approximate"
 * means the customer photo remains useful but the selected construction is not
 * fully represented. It never upgrades fit, drape, colour or physical evidence.
 */
export function photoPreviewSupportForChoice(
  styleKey:keyof DesignerStyle,
  label:string,
):PhotoPreviewSupportDetail {
  switch(styleKey){
    case "collar":
      return label==="Point (Standard) Collar"
        ? {status:"exact",reason:"The photographed template uses the same point-collar geometry."}
        : {status:"approximate",reason:"The photograph keeps its existing point-collar geometry; this selected collar remains a construction specification."};
    case "collarFinish":
      return label==="Self-fabric"
        ? {status:"exact",reason:"The photographed collar region uses the selected shirt fabric."}
        : {status:"approximate",reason:"Contrast placement is shown, but the separate physical white collar/cuff cloth is not selected or verified."};
    case "cuff":
      return label==="Barrel Cuff (1-button)"
        ? {status:"exact",reason:"The photographed template uses the same one-button barrel-cuff geometry."}
        : {status:"approximate",reason:"The photograph keeps its existing barrel-cuff geometry; the selected cuff remains a construction specification."};
    case "placket":
      return label==="Standard (visible stitch)"
        ? {status:"exact",reason:"The photographed shirt uses the same visible standard placket."}
        : {status:"approximate",reason:"The photograph keeps its existing visible placket; hidden/fly-front construction is not redrawn."};
    case "shirtFit":
      return label==="Regular / Classic Fit"
        ? {status:"exact",reason:"The studio shirt silhouette is the regular/classic photographed fit."}
        : {status:"approximate",reason:"Fabric and photographic folds update, but the source shirt silhouette is not physically re-cut for this fit."};
    case "shirtWear":
      return ["Tucked","Untucked"].includes(label)
        ? {status:"exact",reason:"A dedicated photographed tucked or untucked template is used."}
        : {status:"none",reason:"No photographed shirt-wear template exists for this choice."};
    case "trouser":
      if(label==="Pleated Trouser") return {status:"exact",reason:"The photographed straight-leg trouser template is single-pleated."};
      if(label==="Wide-leg / Relaxed Drape Trouser") return {status:"approximate",reason:"A photographed wide-leg template exists for untucked looks; tucked looks still use the tucked straight-leg template."};
      return {status:"approximate",reason:"The selected trouser fabric is photographic, but this trouser cut is not represented by a matching source photo."};
    case "rise":
      return label==="Mid Rise"
        ? {status:"approximate",reason:"Mid rise matches the tucked source; rise is hidden by untucked shirts and is therefore context-dependent."}
        : {status:"approximate",reason:"The photographed waistband/rise is not moved to match this selection."};
    case "waistband":
      return label==="Belt Loops"
        ? {status:"approximate",reason:"Belt-loop detail matches the tucked source; waistband is hidden in untucked looks."}
        : {status:"approximate",reason:"The selected waistband remains a specification; the photographed waistband hardware is not rebuilt."};
    case "break":
      if(label==="Slight Break") return {status:"approximate",reason:"Slight break matches the pleated/tucked templates but not every trouser-template context."};
      if(label==="Full Break") return {status:"approximate",reason:"Full break matches the photographed wide-leg template but not every trouser-template context."};
      return {status:"approximate",reason:"The photographed trouser length is not re-cut to this break."};
    case "button":
      return {status:"approximate",reason:"Button placement remains photographic, but the selected button material is specification-only at instant-preview scale."};
    default:
      return {status:"approximate",reason:"The instant photo communicates the outfit while this construction detail remains provisional."};
  }
}
