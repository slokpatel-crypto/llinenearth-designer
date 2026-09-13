"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
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
  if(mode==="shirt") return <svg viewBox="0 0 360 520" className="measureFigure" aria-label="Shirt body measurement guide">
    <path className="bodyGhost" d="M140 74Q180 50 220 74L252 120 282 166 255 205 238 174 232 420Q180 452 128 420L122 174 105 205 78 166 108 120Z"/>
    <path className="bodyGhostLine" d="M180 80V426M122 180Q180 205 238 180"/>
    <g className={active==="neck"?"guide active":"guide"}><ellipse cx="180" cy="82" rx="34" ry="12"/><text x="225" y="80">N</text></g>
    <g className={active==="chest"?"guide active":"guide"}><path d="M112 166H248"/><text x="255" y="170">C</text></g>
    <g className={active==="waist"?"guide active":"guide"}><path d="M126 260H234"/><text x="242" y="264">W</text></g>
    <g className={active==="shoulder"?"guide active":"guide"}><path d="M126 112H234"/><text x="242" y="116">S</text></g>
    <g className={active==="sleeve"?"guide active":"guide"}><path d="M238 118Q273 174 260 330"/><text x="274" y="238">SL</text></g>
    <g className={active==="shirtLength"?"guide active":"guide"}><path d="M162 98V420"/><text x="145" y="276">L</text></g>
    <g className={active==="bicep"?"guide active":"guide"}><path d="M245 162L275 158"/><text x="282" y="162">B</text></g>
    <g className={active==="wrist"?"guide active":"guide"}><path d="M250 328L270 328"/><text x="278" y="332">WR</text></g>
  </svg>;
  return <svg viewBox="0 0 360 520" className="measureFigure" aria-label="Trouser body measurement guide">
    <path className="bodyGhost" d="M128 72Q180 54 232 72L242 170 216 452 183 452 180 222 177 452 144 452 118 170Z"/>
    <g className={active==="waist"?"guide active":"guide"}><path d="M122 90H238"/><text x="246" y="94">W</text></g>
    <g className={active==="seat"?"guide active":"guide"}><path d="M120 148H240"/><text x="248" y="152">H</text></g>
    <g className={active==="thigh"?"guide active":"guide"}><path d="M126 218H177M183 218H234"/><text x="242" y="222">T</text></g>
    <g className={active==="frontRise"?"guide active":"guide"}><path d="M180 92V226"/><text x="188" y="166">R</text></g>
    <g className={active==="inseam"?"guide active":"guide"}><path d="M180 228V452"/><text x="188" y="350">I</text></g>
    <g className={active==="outseam"?"guide active":"guide"}><path d="M234 90L216 452"/><text x="242" y="290">O</text></g>
    <g className={active==="knee"?"guide active":"guide"}><path d="M139 336H176M184 336H221"/><text x="229" y="340">K</text></g>
    <g className={active==="hem"?"guide active":"guide"}><path d="M145 446H177M183 446H215"/><text x="224" y="450">BO</text></g>
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
    <div className="measurementHero"><div><p className="eyebrow">TAILORING TOOL · BODY MEASUREMENTS</p><h1>Measure once. Design with proportion.</h1><p>Use a soft tailor&apos;s tape and choose each body measurement on the scale in inches. The Designer can use these values as fit guidance; final cutting should still be checked by a tailor.</p></div><div className="measurementSummary">{summary.map(([a,b])=><div key={a}><span>{a}</span><strong>{b}</strong></div>)}</div></div>

    <div className="measurementTabs"><button className={mode==="shirt"?"active":""} onClick={()=>{setMode("shirt");setActive("neck")}}>Shirt measurements <span>{coverage.shirt}/8</span></button><button className={mode==="pants"?"active":""} onClick={()=>{setMode("pants");setActive("waist")}}>Pant measurements <span>{coverage.pants}/8</span></button><div className="unitToggle"><button className="active" disabled>INCH</button></div></div>

    <div className="measurementWorkbench">
      <div className="measureVisual"><div className="measureVisualHead"><span>{mode==="shirt"?"SHIRT BODY MAP":"TROUSER BODY MAP"}</span><b>{progress}/8 captured</b></div><MeasureDiagram mode={mode} active={active}/><div className="measureTip"><span>{activeField.short}</span><div><strong>{activeField.label}</strong><p>{activeField.tip}</p></div></div></div>
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
        <button className="measureSave" onClick={save}>{saved?"Measurements saved ✓":"Save measurements"}</button><Link href="/designer" className="measureDesignerLink" onClick={save}>Use in Designer Engine <span>→</span></Link><small className="measurePrivacy">Stored locally on this device. No body measurements are sent anywhere until a design request uses them.</small></aside>
    </div>
  </section>;
}
