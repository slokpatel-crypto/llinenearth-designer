import { AppShell } from "@/components/AppShell";
import { WearTypeVisual } from "@/components/WearTypeVisual";
import { fabricTypes, wearTypes, type WearFamily } from "@/lib/fashion-intelligence";
import { knowledgeSummary } from "@/lib/knowledge";
import "./knowledge.css";

const familyLabel: Record<WearFamily,string> = { shirt:"Shirts",trouser:"Trousers",jacket:"Jackets",suit:"Suits",indian:"Indian Formalwear" };
const families: WearFamily[] = ["shirt","trouser","jacket","suit","indian"];
const roleColumns: { key: WearFamily; label: string }[] = [{key:"shirt",label:"Shirt"},{key:"trouser",label:"Trouser"},{key:"jacket",label:"Blazer / Jacket"},{key:"suit",label:"Suit"},{key:"indian",label:"Indian"}];

function fitClass(best:boolean, score:number) { return best ? (score>=85?"fitExcellent":"fitStrong") : score>=60 ? "fitConditional" : "fitAvoid"; }
function fitWord(best:boolean, score:number) { return best ? (score>=85?"Excellent":"Strong") : score>=60 ? "Conditional" : "Avoid"; }

export default function Knowledge(){
  return <AppShell>
    <section className="knowledgeV2Hero wrap">
      <p className="eyebrow">FASHION BRAIN · LE-KB-2.0.0</p>
      <h1>Wear, fabric and occasion now speak the same language.</h1>
      <p>The library is no longer a flat list. Each garment type carries construction and formality signals; each fabric carries drape, structure, breathability, wrinkle and occasion logic that the Designer can judge before proposing an outfit.</p>
      <div className="knowledgeStats"><div><span>WEAR TYPES</span><strong>{knowledgeSummary.garments}</strong></div><div><span>FABRIC FAMILIES</span><strong>{knowledgeSummary.fabrics}</strong></div><div><span>CONTEXTS</span><strong>{knowledgeSummary.contexts}</strong></div><div><span>AESTHETICS</span><strong>{knowledgeSummary.aesthetics}</strong></div></div>
      <div className="knowledgeTabs">{families.map((family)=><a key={family} href={`#${family}`}>{familyLabel[family]}</a>)}<a href="#fabrics">Fabric intelligence</a><a href="#matrix">Suitability matrix</a></div>
    </section>

    {families.map((family)=><section className="librarySection wrap" id={family} key={family}>
      <div className="libraryHead"><p className="eyebrow">WEAR TYPE LIBRARY</p><div><h2>{familyLabel[family]}</h2><p>Display visuals are controlled LLinen Earth type diagrams rather than copied fashion photography. They are designed to communicate silhouette and construction cues while the knowledge record holds the deeper rules.</p></div></div>
      <div className="wearGrid">{wearTypes.filter((wear)=>wear.family===family).map((wear)=><article className="wearCard" key={wear.id}>
        <WearTypeVisual wear={wear}/>
        <div className="wearCardCopy"><span>{wear.subtype} · formality {wear.formality}/100</span><h3>{wear.name}</h3><p>{wear.visual.note}</p><div className="wearTraits"><i>{wear.structure}</i>{wear.visual.collar&&<i>{wear.visual.collar}</i>}{wear.visual.lapel&&<i>{wear.visual.lapel}</i>}{wear.visual.rise&&<i>{wear.visual.rise} rise</i>}{typeof wear.visual.pleats==="number"&&<i>{wear.visual.pleats} pleat{wear.visual.pleats===1?"":"s"}</i>}</div></div>
      </article>)}</div>
    </section>)}

    <section className="librarySection wrap" id="fabrics">
      <div className="libraryHead"><p className="eyebrow">FABRIC INTELLIGENCE</p><div><h2>Fabric is treated as engineering, not decoration.</h2><p>Important Indian suiting categories are included explicitly: TR/PV is polyester–viscose/rayon suiting; TR-Wool adds wool to that family. The actual blend percentage and weave still matter, so the system preserves uncertainty instead of pretending every bolt with the same trade name behaves identically.</p></div></div>
      <div className="fabricGridV2">{fabricTypes.map((fabric)=><article className="fabricCard" key={fabric.id}>
        <span>{fabric.sheen} · formality {fabric.formality}/100</span><h3>{fabric.name}</h3><p className="fabricComposition">{fabric.composition}</p>
        <div className="meterGroup"><div className="meter"><span>Breathability</span><b><i style={{width:`${fabric.breathability}%`}}/></b><em>{fabric.breathability}</em></div><div className="meter"><span>Drape</span><b><i style={{width:`${fabric.drape}%`}}/></b><em>{fabric.drape}</em></div><div className="meter"><span>Structure</span><b><i style={{width:`${fabric.structure}%`}}/></b><em>{fabric.structure}</em></div><div className="meter"><span>Wrinkle resist.</span><b><i style={{width:`${fabric.wrinkleResistance}%`}}/></b><em>{fabric.wrinkleResistance}</em></div></div>
        <div className="fabricUses">{fabric.bestGarments.map((role)=><span key={role}>{familyLabel[role]}</span>)}</div><p className="fabricCaution">{fabric.cautions[0]}</p>
      </article>)}</div>
      <p className="sourceNote"><strong>Knowledge policy:</strong> public fashion references can inform taxonomy and construction language, but LLinen Earth display assets are generated/owned type visuals unless a separate commercial licence is recorded. Fibre names and trade labels are never treated as a substitute for verified composition, weight and weave.</p>
    </section>

    <section className="librarySection wrap" id="matrix">
      <div className="libraryHead"><p className="eyebrow">FABRIC × GARMENT MATRIX</p><div><h2>What should this cloth become?</h2><p>The Designer uses this matrix together with climate, occasion, formality and the uploaded-fabric confidence. “Conditional” means the fabric can work, but construction or styling needs compensation.</p></div></div>
      <div className="matrix"><div className="matrixRow header"><strong>Fabric</strong>{roleColumns.map((role)=><strong key={role.key}>{role.label}</strong>)}</div>{fabricTypes.map((fabric)=><div className="matrixRow" key={fabric.id}><strong>{fabric.name}</strong>{roleColumns.map((role)=>{const best=fabric.bestGarments.includes(role.key);const score=role.key==="shirt"?fabric.breathability:role.key==="trouser"?Math.round((fabric.drape+fabric.structure+fabric.wrinkleResistance)/3):role.key==="indian"?Math.round((fabric.formality+fabric.drape)/2):Math.round((fabric.formality+fabric.structure+fabric.drape)/3);return <span className={fitClass(best,score)} key={role.key}>{fitWord(best,score)}</span>})}</div>)}</div>
    </section>
  </AppShell>;
}
