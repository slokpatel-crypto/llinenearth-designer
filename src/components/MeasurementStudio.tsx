"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { emptyMeasurementProfile, formatMeasure, fromCm, MEASUREMENT_STORAGE_KEY, measurementCoverage, toCm, type MeasurementProfile } from "@/lib/measurements";

type Mode = "shirt" | "pants";
type Field = { key: string; label: string; short: string; min: number; max: number; tip: string };

const SCALE_MIN = 0.01;
const SCALE_MAX = 100;
const SCALE_STEP = 0.01;

const shirtFields: Field[] = [
  { key:"neck",label:"Neck",short:"N",min:30,max:55,tip:"Wrap the tape around the base of the neck where the collar sits. Keep one finger under the tape." },
  { key:"chest",label:"Chest",short:"C",min:75,max:150,tip:"Measure around the fullest part of the chest, tape level across the back, arms relaxed." },
  { key:"waist",label:"Shirt waist",short:"W",min:65,max:150,tip:"Measure around the natural waist / narrowest torso point without pulling the tape tight." },
  { key:"shoulder",label:"Shoulder",short:"S",min:35,max:65,tip:"Measure straight across the back from shoulder point to shoulder point." },
  { key:"sleeve",label:"Sleeve length",short:"SL",min:50,max:80,tip:"From shoulder point, follow the arm to the wrist bone with the elbow slightly bent." },
  { key:"shirtLength",label:"Shirt length",short:"L",min:60,max:95,tip:"From the high shoulder point beside the neck, measure vertically to the desired shirt hem." },
  { key:"bicep",label:"Bicep",short:"B",min:20,max:55,tip:"Measure around the fullest upper arm with the arm relaxed." },
  { key:"wrist",label:"Wrist",short:"WR",min:12,max:30,tip:"Measure around the wrist where the cuff will sit." },
];
const pantFields: Field[] = [
  { key:"waist",label:"Trouser waist",short:"W",min:60,max:150,tip:"Measure around the exact position where you want the trouser waistband to sit." },
  { key:"seat",label:"Seat / hip",short:"H",min:75,max:160,tip:"Measure around the fullest part of the seat, keeping the tape horizontal." },
  { key:"thigh",label:"Thigh",short:"T",min:40,max:95,tip:"Measure around the fullest upper thigh, just below the crotch." },
  { key:"frontRise",label:"Front rise",short:"R",min:20,max:45,tip:"From the front waistband position, measure through the crotch seam reference to the crotch point." },
  { key:"inseam",label:"Inseam",short:"I",min:55,max:100,tip:"From the crotch point down the inside leg to the desired hem." },
  { key:"outseam",label:"Outseam",short:"O",min:80,max:125,tip:"From the waistband position down the outside leg to the desired hem." },
  { key:"knee",label:"Knee",short:"K",min:30,max:65,tip:"Measure around the knee at the kneecap while standing naturally." },
  { key:"hem",label:"Bottom opening",short:"BO",min:24,max:55,tip:"Measure the desired circumference around the trouser hem / ankle opening." },
];

function MeasureDiagram({mode,active}:{mode:Mode;active:string}){
  const Guide = ({id,children}:{id:string;children:ReactNode}) =>
    <g className={active===id?"guide active":"guide"} data-measure={id}>{children}</g>;

  if(mode==="shirt") return <svg viewBox="0 0 440 560" className="measureFigure blueprintFigure" aria-label="Blueprint shirt measurement guide">
    <defs>
      <linearGradient id="shirtGlass" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#9ed8ff" stopOpacity=".11"/>
        <stop offset="1" stopColor="#d9efff" stopOpacity=".025"/>
      </linearGradient>
      <filter id="measureGlow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="4.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    <g className="draftDepth shirtDepth" transform="translate(14 -11)">
      <path d="M142 102 L191 77 L249 77 L298 102 L352 135 L387 211 L353 228 L326 174 L313 449 Q220 474 127 449 L114 174 L87 228 L53 211 L88 135 Z"/>
      <path d="M191 77 L198 111 L220 132 L242 111 L249 77"/>
      <path d="M220 132V451"/>
      <path d="M114 174Q220 204 326 174"/>
      <path d="M127 449Q220 470 313 449"/>
    </g>

    <g className="draftConnectors">
      <path d="M142 102l14-11M298 102l14-11M352 135l14-11M387 211l14-11M313 449l14-11"/>
    </g>

    <g className="draftGarment">
      <path className="draftFill" d="M142 102 L191 77 L249 77 L298 102 L352 135 L387 211 L353 228 L326 174 L313 449 Q220 474 127 449 L114 174 L87 228 L53 211 L88 135 Z"/>
      <path d="M191 77 L198 111 L220 132 L242 111 L249 77"/>
      <path d="M220 132V451"/>
      <path d="M114 174Q220 204 326 174"/>
      <path d="M127 449Q220 470 313 449"/>
      <path d="M176 105L220 132L264 105"/>
      <path d="M171 91L198 111M269 91L242 111"/>
      <path d="M88 135Q75 170 53 211M352 135Q365 170 387 211"/>
      <path d="M91 202L66 214M349 202L374 214"/>
      <path className="construction" d="M141 102V448M299 102V448M114 174L127 449M326 174L313 449"/>
    </g>

    <Guide id="neck"><ellipse cx="220" cy="94" rx="43" ry="17"/><path d="M184 94Q220 117 256 94"/><text x="274" y="97">NECK</text></Guide>
    <Guide id="chest"><path d="M112 186 Q220 211 328 186"/><path d="M112 186 Q220 165 328 186" className="guideBack"/><text x="342" y="190">CHEST</text></Guide>
    <Guide id="waist"><path d="M126 292 Q220 310 314 292"/><path d="M126 292 Q220 276 314 292" className="guideBack"/><text x="329" y="296">WAIST</text></Guide>
    <Guide id="shoulder"><path d="M142 104 L191 79 M249 79 L298 104"/><path d="M191 79H249"/><text x="307" y="108">SHOULDER</text></Guide>
    <Guide id="sleeve"><path d="M299 108 Q350 144 372 210 L354 365"/><circle cx="299" cy="108" r="3"/><circle cx="354" cy="365" r="3"/><text x="371" y="286">SLEEVE</text></Guide>
    <Guide id="shirtLength"><path d="M201 107V449"/><path d="M194 107H208M194 449H208"/><text x="164" y="288">LENGTH</text></Guide>
    <Guide id="bicep"><path d="M326 162 Q351 173 366 163"/><path d="M326 162 Q348 149 366 163" className="guideBack"/><text x="373" y="165">BICEP</text></Guide>
    <Guide id="wrist"><path d="M349 355 Q359 360 369 355"/><path d="M349 355 Q359 347 369 355" className="guideBack"/><text x="376" y="358">WRIST</text></Guide>

    <g className="draftAxis">
      <path d="M28 500H412"/><path d="M42 514L398 486"/>
      <text x="28" y="528">SHIRT DRAFT / FRONT PROJECTION</text>
    </g>
  </svg>;

  return <svg viewBox="0 0 440 560" className="measureFigure blueprintFigure" aria-label="Blueprint trouser measurement guide">
    <defs>
      <linearGradient id="pantGlass" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#9ed8ff" stopOpacity=".11"/>
        <stop offset="1" stopColor="#d9efff" stopOpacity=".025"/>
      </linearGradient>
      <filter id="measureGlowPant" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="4.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    <g className="draftDepth trouserDepth" transform="translate(14 -11)">
      <path d="M128 78 Q220 57 312 78 L325 185 L286 486 L228 486 L220 235 L212 486 L154 486 L115 185 Z"/>
      <path d="M128 78Q220 95 312 78"/>
      <path d="M220 91V238"/>
      <path d="M115 185Q220 214 325 185"/>
    </g>

    <g className="draftConnectors">
      <path d="M128 78l14-11M312 78l14-11M325 185l14-11M286 486l14-11M154 486l14-11"/>
    </g>

    <g className="draftGarment">
      <path className="draftFill" d="M128 78 Q220 57 312 78 L325 185 L286 486 L228 486 L220 235 L212 486 L154 486 L115 185 Z"/>
      <path d="M128 78Q220 95 312 78"/>
      <path d="M220 91V238"/>
      <path d="M115 185Q220 214 325 185"/>
      <path d="M160 84Q173 122 211 135M280 84Q267 122 229 135"/>
      <path className="construction" d="M154 185L154 486M286 185L286 486M212 235L212 486M228 235L228 486"/>
    </g>

    <Guide id="waist"><path d="M124 89 Q220 109 316 89"/><path d="M124 89 Q220 70 316 89" className="guideBack"/><text x="330" y="93">WAIST</text></Guide>
    <Guide id="seat"><path d="M116 170 Q220 197 324 170"/><path d="M116 170 Q220 145 324 170" className="guideBack"/><text x="338" y="174">SEAT</text></Guide>
    <Guide id="thigh"><path d="M126 234 Q170 249 214 234"/><path d="M126 234 Q170 220 214 234" className="guideBack"/><text x="68" y="238">THIGH</text></Guide>
    <Guide id="frontRise"><path d="M220 92V236"/><path d="M211 92H229M211 236H229"/><text x="232" y="169">RISE</text></Guide>
    <Guide id="inseam"><path d="M220 239 L229 486"/><path d="M212 239L212 486"/><text x="236" y="367">INSEAM</text></Guide>
    <Guide id="outseam"><path d="M316 90 L286 486"/><path d="M308 90L324 91M278 486L294 486"/><text x="318" y="307">OUTSEAM</text></Guide>
    <Guide id="knee"><path d="M142 350 Q176 360 211 350 M229 350 Q264 360 298 350"/><text x="310" y="354">KNEE</text></Guide>
    <Guide id="hem"><path d="M154 475 Q183 483 212 475 M228 475 Q257 483 286 475"/><text x="297" y="479">HEM</text></Guide>

    <g className="draftAxis">
      <path d="M28 515H412"/><path d="M42 530L398 500"/>
      <text x="28" y="543">TROUSER DRAFT / FRONT PROJECTION</text>
    </g>
  </svg>;
}

export function MeasurementStudio(){
  const [profile,setProfile]=useState<MeasurementProfile>(emptyMeasurementProfile());
  const [mode,setMode]=useState<Mode>("shirt");
  const [active,setActive]=useState("neck");
  const [saved,setSaved]=useState(false);

  useEffect(()=>{try{const raw=localStorage.getItem(MEASUREMENT_STORAGE_KEY);if(raw){const parsed=JSON.parse(raw) as MeasurementProfile;setProfile({...parsed,unit:"in"});}}catch{}},[]);
  const unit="in" as const; const fields=mode==="shirt"?shirtFields:pantFields; const coverage=measurementCoverage(profile);
  const activeField=fields.find(f=>f.key===active)||fields[0];
  const values=(mode==="shirt"?profile.shirt:profile.pants) as Record<string,number|undefined>;
  const current=values[activeField.key];
  const sliderValue=current==null?SCALE_MIN:Math.min(SCALE_MAX,Math.max(SCALE_MIN,fromCm(current,unit)));
  const selectedDisplay=current==null?"Not set":`${fromCm(current,unit).toFixed(2)} in`;
  const invalid=current!=null&&(current<activeField.min||current>activeField.max);
  const scaleFill=((sliderValue-SCALE_MIN)/(SCALE_MAX-SCALE_MIN))*100;

  function setValue(key:string,display:string){
    const n=Number(display); const cm=Number.isFinite(n)&&n>0?toCm(n,unit):undefined;
    setProfile(p=>({...p,unit:"in",[mode]:{...p[mode],[key]:cm},updatedAt:new Date().toISOString()}));setSaved(false);
  }
  function save(){const inchProfile={...profile,unit:"in" as const};localStorage.setItem(MEASUREMENT_STORAGE_KEY,JSON.stringify(inchProfile));setProfile(inchProfile);setSaved(true);}
  const progress=mode==="shirt"?coverage.shirt:coverage.pants;
  const summary=useMemo(()=>[
    ["Shirt",`${coverage.shirt}/8`],["Pants",`${coverage.pants}/8`],["Unit","INCHES"]
  ],[coverage.shirt,coverage.pants]);

  return <section className="measurementStudio">
    <div className="measurementStatusBar"><div><span>MEASUREMENT CAPTURE</span><strong>Select a line. Follow the white guide. Enter the value.</strong></div><div className="measurementSummary">{summary.map(([a,b])=><div key={a}><span>{a}</span><strong>{b}</strong></div>)}</div></div>

    <div className="measurementTabs"><button className={mode==="shirt"?"active":""} onClick={()=>{setMode("shirt");setActive("neck")}}>Shirt <span>{coverage.shirt}/8</span></button><button className={mode==="pants"?"active":""} onClick={()=>{setMode("pants");setActive("waist")}}>Trouser <span>{coverage.pants}/8</span></button><div className="unitToggle"><button className="active" disabled>INCH</button></div></div>

    <div className="measurementWorkbench">
      <div className="measureVisual"><div className="blueprintVisualGrid"/><div className="measureVisualHead"><span>{mode==="shirt"?"SHIRT BLUEPRINT":"TROUSER BLUEPRINT"}</span><b>{activeField.short} · {activeField.label}</b></div><div className="measureBlueprintStage"><MeasureDiagram mode={mode} active={active}/><div className="measureBlueprintLegend"><span><i/> active measurement</span><span><i/> construction line</span></div></div><div className="measureTip"><span>{activeField.short}</span><div><strong>{activeField.label}</strong><p>{activeField.tip}</p></div></div></div>
      <div className="measureFields"><div className="measureFieldsHead"><div><span className="micro">STEP-BY-STEP</span><h2>{mode==="shirt"?"Shirt block":"Trouser block"}</h2></div><p>Tap a measurement to highlight exactly where it is taken.</p></div>
        <div className="measureList">{fields.map((field,index)=>{const v=values[field.key];const bad=v!=null&&(v<field.min||v>field.max);return <button key={field.key} className={`${active===field.key?"active":""} ${v?"filled":""}`} onClick={()=>setActive(field.key)}><span>{index+1}</span><div><strong>{field.label}</strong><small>{v?formatMeasure(v,unit):field.tip}</small></div><em>{v?"✓":"→"}</em>{bad&&<i>check</i>}</button>})}</div>
      </div>
      <aside className="measureEntry"><span className="micro">NOW MEASURING</span><h2>{activeField.label}</h2><p>{activeField.tip}</p>
        <div className="measurementScale">
          <div className="measurementScaleHead"><span>SELECT ON SCALE</span><div className="measurementScaleValue"><strong>{selectedDisplay}</strong><small>0.01 inch precision</small></div></div>
          <input className="measurementRangeInput" type="range" min={SCALE_MIN} max={SCALE_MAX} step={SCALE_STEP} value={sliderValue} onChange={e=>setValue(activeField.key,e.target.value)} aria-label={`${activeField.label} in inches`} style={{"--scale-fill":`${scaleFill}%`} as CSSProperties}/>
          <div className="measurementScaleTicks" aria-hidden="true"><span>0.01</span><span>25</span><span>50</span><span>75</span><span>100 in</span></div>
          <div className="measurementScaleMeta"><span>TAILORING GUIDE</span><strong>{formatMeasure(activeField.min,unit)} – {formatMeasure(activeField.max,unit)}</strong><p>The full selector runs from 0.01 to 100 inches. The highlighted guide range helps you catch an accidental selection.</p></div>
        </div>
        {invalid&&<p className="measureWarning">This value is outside the usual tailoring range. Recheck the tape and scale position.</p>}
        <button className="measureSave" onClick={save}>{saved?"Measurements saved ✓":"Save measurements"}</button><Link href="/designer-studio" className="measureDesignerLink" onClick={save}>Use in Designer <span>→</span></Link><small className="measurePrivacy">Stored locally on this device. No body measurements are sent anywhere until a design request uses them.</small></aside>
    </div>
  </section>;
}
