import Link from "next/link";
import { notFound } from "next/navigation";
import { StyleDirectorRealModelPreview } from "@/components/PhotoOutfitPreview";
import { DESIGNER_PANTS, DESIGNER_SHIRTS, designerStyleForOccasion } from "@/lib/designer/engine";
import { verifyDesignShareToken } from "@/lib/designer/design-share";
import "./share.css";

export const dynamic="force-dynamic";

export default async function SharedDesignPage({params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  const payload=verifyDesignShareToken(token);
  if(!payload) notFound();

  const shirt=DESIGNER_SHIRTS.find((item)=>item.id===payload.fabrics.shirt.id);
  const pant=DESIGNER_PANTS.find((item)=>item.id===payload.fabrics.trouser.id);
  const style={
    ...designerStyleForOccasion(payload.context.occasion),
    shirtFit:payload.shirt.fit,
    shirtWear:payload.shirt.wear,
    collar:payload.shirt.collar,
    collarFinish:payload.shirt.collarFinish,
    cuff:payload.shirt.cuff,
    placket:payload.shirt.placket,
    button:payload.shirt.button,
    trouser:payload.trouser.shape,
    rise:payload.trouser.rise,
    waistband:payload.trouser.waistband,
    break:payload.trouser.break,
  };
  const designerParams=new URLSearchParams({
    shirt:payload.fabrics.shirt.id,
    pant:payload.fabrics.trouser.id,
    occasion:payload.context.occasion,
    climate:payload.context.climate,
    intention:payload.context.intention,
    from:"shared-design",
  });

  return <main className="sharedDesign">
    <header className="sharedDesignHeader">
      <Link href="/" className="sharedDesignBrand"><span>LE</span><b>LINEN EARTH</b></Link>
      <span>SHARED LOCKED DESIGN</span>
    </header>

    <section className="sharedDesignHero">
      <div className="sharedDesignCopy">
        <span>LOCKED RECIPE · {payload.revisionId}</span>
        <h1>{payload.fabrics.shirt.name}<br/><em>with {payload.fabrics.trouser.name}</em></h1>
        <p>This share contains the design recipe only. Customer measurements, body-profile data, stock reservation and price are not included in the public link.</p>
        <div className="sharedDesignMeta">
          <span><small>OCCASION</small><b>{payload.context.occasion}</b></span>
          <span><small>SHIRT</small><b>{payload.shirt.fit} · {payload.shirt.wear}</b></span>
          <span><small>COLLAR</small><b>{payload.shirt.collar}</b></span>
          <span><small>CUFF</small><b>{payload.shirt.cuff}</b></span>
          <span><small>TROUSER</small><b>{payload.trouser.shape} · {payload.trouser.rise}</b></span>
          <span><small>RECIPE HASH</small><b>{payload.recipeHash.slice(0,12).toUpperCase()}</b></span>
        </div>
        {payload.creative&&<section className="sharedDesignCreative">
          <small>CREATIVE DIRECTION</small>
          <strong>{payload.creative.name}</strong>
          <div>{payload.creative.treatments.slice(0,4).map((item)=><span key={item.id}>{item.label}</span>)}</div>
        </section>}
        <div className="sharedDesignActions">
          <Link href={`/designer-studio?${designerParams.toString()}`}>Open in Designer <b>↗</b></Link>
          <Link href="/measurements">Measurements <b>↗</b></Link>
        </div>
      </div>

      <div className="sharedDesignVisual">
        {shirt&&pant ? <StyleDirectorRealModelPreview shirt={shirt} pant={pant} style={style}/> : <div className="sharedDesignUnavailable"><b>Visual preview unavailable</b><span>The locked recipe remains valid, but this fabric is not in the current static preview catalogue.</span></div>}
        <div className="sharedDesignSwatches">
          <article>{shirt&&<img src={shirt.image} alt={payload.fabrics.shirt.name}/>}<span>SHIRT</span><b>{payload.fabrics.shirt.name}</b></article>
          <article>{pant&&<img src={pant.image} alt={payload.fabrics.trouser.name}/>}<span>TROUSER</span><b>{payload.fabrics.trouser.name}</b></article>
        </div>
      </div>
    </section>

    <footer className="sharedDesignFooter">
      <span>Shared design expires automatically.</span>
      <span>No body measurements are contained in this link.</span>
    </footer>
  </main>;
}
