"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";

type GarmentKey = "shirt" | "trouser" | "suit" | "blazer";
type Option = { name: string; detail: string; note: string };
type GarmentConfig = { label: string; eyebrow: string; copy: string; options: Option[] };

const garments: Record<GarmentKey, GarmentConfig> = {
  shirt: { label: "Shirts", eyebrow: "01 / SHIRT STUDIO", copy: "Read collar proportion, cloth texture and drape on one consistent studio form.", options: [
    { name: "Spread collar", detail: "balanced points", note: "Versatile tailoring" },
    { name: "Cutaway collar", detail: "wide opening", note: "Sharper, more European" },
    { name: "Button-down", detail: "soft roll", note: "Relaxed structure" },
    { name: "Cuban collar", detail: "open camp neck", note: "Resort direction" },
  ]},
  trouser: { label: "Trousers", eyebrow: "02 / TROUSER STUDIO", copy: "See rise, pleat architecture, taper and the real cloth repeat before tailoring.", options: [
    { name: "Flat front", detail: "clean waist", note: "Modern and precise" },
    { name: "Single pleat", detail: "one forward fold", note: "Refined comfort" },
    { name: "Double pleat", detail: "two folds", note: "Fuller tailored line" },
    { name: "Gurkha", detail: "extended waistband", note: "Statement waist detail" },
  ]},
  suit: { label: "Suits", eyebrow: "03 / SUIT STUDIO", copy: "Compare lapel scale, stance and cloth character without changing the visual model.", options: [
    { name: "2-button SB", detail: "notch lapel", note: "Classic proportion" },
    { name: "Double-breasted", detail: "6×2 stance", note: "Architectural presence" },
    { name: "Soft suit", detail: "light shoulder", note: "Italian ease" },
    { name: "Dinner suit", detail: "evening lapel", note: "Formal after dark" },
  ]},
  blazer: { label: "Blazers", eyebrow: "04 / BLAZER STUDIO", copy: "Switch between soft and structured jacket ideas while keeping the cloth visible.", options: [
    { name: "Soft blazer", detail: "natural shoulder", note: "Relaxed tailoring" },
    { name: "Structured blazer", detail: "defined shoulder", note: "Sharper authority" },
    { name: "DB blazer", detail: "double-breasted", note: "Stronger silhouette" },
    { name: "Safari jacket", detail: "utility pockets", note: "Elevated casual" },
  ]},
};

const palettes = [
  { name: "Cream linen", value: "#ddd2c2" },
  { name: "Warm stone", value: "#9f9589" },
  { name: "Midnight navy", value: "#14243b" },
  { name: "Charcoal", value: "#474b51" },
  { name: "Black", value: "#17191d" },
];

const references = [
  { title: "Cloth first", label: "TEXTURE / SCALE", image: "https://images.pexels.com/photos/6766236/pexels-photo-6766236.jpeg?auto=compress&cs=tinysrgb&w=1000" },
  { title: "Form second", label: "TAILORING / PROPORTION", image: "https://images.pexels.com/photos/6765639/pexels-photo-6765639.jpeg?auto=compress&cs=tinysrgb&w=1000" },
  { title: "Fit last", label: "ATELIER / EXECUTION", image: "https://images.pexels.com/photos/6766382/pexels-photo-6766382.jpeg?auto=compress&cs=tinysrgb&w=1000" },
];

function FabricDefs({ fabricImage, repeat }: { fabricImage: string | null; repeat: number }) {
  return <defs>
    <linearGradient id="formShade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#f2eee6"/><stop offset=".33" stopColor="#d7d0c6"/><stop offset=".72" stopColor="#aaa39a"/><stop offset="1" stopColor="#77736e"/>
    </linearGradient>
    <linearGradient id="clothLight" x1="0" y1="0" x2="1" y2=".85">
      <stop offset="0" stopColor="rgba(255,255,255,.38)"/><stop offset=".18" stopColor="rgba(255,255,255,.15)"/><stop offset=".52" stopColor="rgba(255,255,255,.015)"/><stop offset=".78" stopColor="rgba(0,0,0,.11)"/><stop offset="1" stopColor="rgba(0,0,0,.36)"/>
    </linearGradient>
    <radialGradient id="clothBloom" cx="30%" cy="20%" r="82%"><stop offset="0" stopColor="rgba(255,255,255,.22)"/><stop offset=".55" stopColor="rgba(255,255,255,0)"/><stop offset="1" stopColor="rgba(0,0,0,.16)"/></radialGradient>
    <pattern id="wovenBase" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 1.3H6M0 4.4H6M1.4 0V6M4.5 0V6" stroke="rgba(255,255,255,.09)" strokeWidth=".34"/><path d="M0 2.9H6M2.9 0V6" stroke="rgba(0,0,0,.05)" strokeWidth=".28"/></pattern>
    {fabricImage && <pattern id="uploadedFabric" width={repeat} height={repeat} patternUnits="userSpaceOnUse"><image href={fabricImage} width={repeat} height={repeat} preserveAspectRatio="xMidYMid slice"/></pattern>}
    <filter id="studioShadow" x="-45%" y="-35%" width="190%" height="190%"><feDropShadow dx="-13" dy="23" stdDeviation="20" floodColor="#000" floodOpacity=".5"/></filter>
    <filter id="clothDepth" x="-12%" y="-12%" width="124%" height="124%"><feTurbulence type="fractalNoise" baseFrequency=".014 .085" numOctaves="2" seed="11" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" xChannelSelector="R" yChannelSelector="G"/></filter>
  </defs>;
}

function ClothSurface({ d, fill }: { d: string; fill: string }) {
  return <><path d={d} fill={fill}/>{fill !== "url(#uploadedFabric)" && <path d={d} fill="url(#wovenBase)"/>}<path d={d} fill="url(#clothLight)" opacity=".56"/><path d={d} fill="url(#clothBloom)" opacity=".58"/></>;
}

function RealisticForm({ active, color, fabricImage, option, repeat }: { active: GarmentKey; color: string; fabricImage: string | null; option: number; repeat: number }) {
  const fill = fabricImage ? "url(#uploadedFabric)" : color;
  const isJacket = active === "suit" || active === "blazer";
  const doubleBreasted = (active === "suit" && option === 1) || (active === "blazer" && option === 2);

  if (active === "trouser") {
    const trouser = "M140 118 C168 97 196 91 230 91 C264 91 292 97 320 118 L306 229 270 620 236 620 230 263 224 620 190 620 154 229Z";
    return <svg className="atelierMannequin realisticForm lowerForm" viewBox="0 0 460 700" role="img" aria-label="Tailoring mannequin wearing selected trousers">
      <FabricDefs fabricImage={fabricImage} repeat={repeat}/><ellipse cx="230" cy="650" rx="124" ry="23" fill="rgba(0,0,0,.42)"/>
      <path d="M165 88 C183 67 202 60 230 60 C258 60 277 67 295 88 L292 196 269 620 237 620 230 274 223 620 191 620 168 196Z" fill="url(#formShade)" opacity=".9"/>
      <g filter="url(#studioShadow)"><g filter="url(#clothDepth)"><ClothSurface d={trouser} fill={fill}/></g>
        <path d="M146 127 C190 142 270 142 314 127" stroke="rgba(255,255,255,.34)" strokeWidth="3.8" fill="none"/><path d="M230 132V260" stroke="rgba(5,10,16,.22)" strokeWidth="1.4"/>
        {option > 0 && <path d="M188 133 C191 164 199 195 217 232M272 133 C269 164 261 195 243 232" stroke="rgba(5,10,16,.3)" strokeWidth="2" fill="none"/>}
        {option === 2 && <path d="M172 133 C177 165 185 194 204 229M288 133 C283 165 275 194 256 229" stroke="rgba(5,10,16,.22)" strokeWidth="1.6" fill="none"/>}
        {option === 3 && <><path d="M148 121 L191 150 176 169 143 139Z" fill="rgba(0,0,0,.18)"/><path d="M312 121 L269 150 284 169 317 139Z" fill="rgba(0,0,0,.18)"/></>}
        <path d="M178 283 C195 273 210 271 222 277M238 277 C250 271 265 273 282 283" stroke="rgba(255,255,255,.12)" fill="none"/><path d="M196 154 C188 252 186 403 190 575M264 154 C272 252 274 403 270 575" stroke="rgba(0,0,0,.08)" fill="none"/>
      </g>
    </svg>;
  }

  const shirtBody = "M157 139 L196 108 230 133 264 108 303 139 334 490 C316 536 280 562 230 578 C180 562 144 536 126 490Z";
  const leftSleeve = "M108 193 C80 213 76 248 82 313 L97 403 123 399 132 267 158 151Z";
  const rightSleeve = "M352 193 C380 213 384 248 378 313 L363 403 337 399 328 267 302 151Z";
  const jacketBody = "M155 138 L193 109 230 149 267 109 305 138 338 502 C313 547 278 570 230 583 C182 570 147 547 122 502Z";

  return <svg className="atelierMannequin realisticForm torsoForm" viewBox="0 0 460 700" role="img" aria-label={`Tailoring mannequin wearing selected ${active}`}>
    <FabricDefs fabricImage={fabricImage} repeat={repeat}/><ellipse cx="230" cy="634" rx="125" ry="23" fill="rgba(0,0,0,.43)"/><path d="M228 580V637" stroke="#6f6559" strokeWidth="8"/><ellipse cx="230" cy="642" rx="58" ry="8" fill="#74695c" opacity=".85"/>
    <g filter="url(#studioShadow)">
      <path d="M164 126 C181 101 202 91 230 91 C258 91 279 101 296 126 C320 136 345 156 359 184 L331 463 C322 525 289 566 230 584 C171 566 138 525 129 463 L101 184 C115 156 140 136 164 126Z" fill="url(#formShade)"/>
      <path d="M107 190 C75 210 62 245 68 308 L85 417 C89 439 113 435 116 412 L116 278 145 205Z" fill="url(#formShade)"/><path d="M353 190 C385 210 398 245 392 308 L375 417 C371 439 347 435 344 412 L344 278 315 205Z" fill="url(#formShade)"/>
      {active === "shirt" && <g filter="url(#clothDepth)"><ClothSurface d={shirtBody} fill={fill}/><ClothSurface d={leftSleeve} fill={fill}/><ClothSurface d={rightSleeve} fill={fill}/></g>}
      {active === "shirt" && <g>
        {option === 0 && <><path d="M157 139 L196 108 230 133 203 169 176 126Z" fill="rgba(255,255,255,.25)"/><path d="M303 139 L264 108 230 133 257 169 284 126Z" fill="rgba(0,0,0,.1)"/></>}
        {option === 1 && <><path d="M157 139 L196 108 230 133 195 159 169 126Z" fill="rgba(255,255,255,.24)"/><path d="M303 139 L264 108 230 133 265 159 291 126Z" fill="rgba(0,0,0,.1)"/></>}
        {option === 2 && <><path d="M162 138 L198 111 230 133 205 165 179 126Z" fill="rgba(255,255,255,.22)"/><path d="M298 138 L262 111 230 133 255 165 281 126Z" fill="rgba(0,0,0,.1)"/><circle cx="195" cy="147" r="2.1" fill="#554b42"/><circle cx="265" cy="147" r="2.1" fill="#554b42"/></>}
        {option === 3 && <path d="M164 138 C190 122 209 120 230 135 C251 120 270 122 296 138 L276 166 230 147 184 166Z" fill="rgba(255,255,255,.18)"/>}
        <path d="M230 133V558" stroke="rgba(18,23,30,.31)" strokeWidth="1.8"/>{[194,238,282,326,370,414,458,502].map(y => <circle key={y} cx="230" cy={y} r="2.55" fill="rgba(20,24,30,.43)"/>)}
        <path d="M143 294 C166 282 195 281 219 292M241 292 C265 281 294 282 317 294" stroke="rgba(255,255,255,.12)" fill="none"/><path d="M151 435 C178 424 199 425 219 433M241 433 C261 425 282 424 309 435" stroke="rgba(0,0,0,.1)" fill="none"/><path d="M117 250 C107 305 108 353 114 389M343 250 C353 305 352 353 346 389" stroke="rgba(255,255,255,.08)" fill="none"/>
      </g>}
      {isJacket && <g>
        <g filter="url(#clothDepth)"><ClothSurface d={jacketBody} fill={fill}/><ClothSurface d={leftSleeve} fill={fill}/><ClothSurface d={rightSleeve} fill={fill}/></g>
        <path d="M193 111 L230 149 191 260 160 149Z" fill="rgba(255,255,255,.15)"/><path d="M267 111 L230 149 269 260 300 149Z" fill="rgba(0,0,0,.15)"/>
        {option === 3 && <path d="M205 149 L230 176 255 149 250 219 210 219Z" fill="#eee9df" opacity=".82"/>}
        {!doubleBreasted && <><path d="M230 149V542" stroke="rgba(5,10,16,.36)" strokeWidth="2"/><circle cx="230" cy="320" r="3.6" fill="rgba(245,239,228,.64)"/><circle cx="230" cy="361" r="3.6" fill="rgba(245,239,228,.64)"/></>}
        {doubleBreasted && <>{[210,250].map(x => <g key={x}><circle cx={x} cy="314" r="3.45" fill="rgba(245,239,228,.64)"/><circle cx={x} cy="355" r="3.45" fill="rgba(245,239,228,.64)"/></g>)}</>}
        <path d="M157 398 L204 405 201 431 159 426Z" fill="rgba(0,0,0,.11)"/><path d="M303 398 L256 405 259 431 301 426Z" fill="rgba(0,0,0,.13)"/>
        {(active === "blazer" && option === 3) && <><rect x="151" y="274" width="58" height="54" rx="3" fill="rgba(0,0,0,.08)"/><rect x="251" y="274" width="58" height="54" rx="3" fill="rgba(0,0,0,.1)"/></>}
        {active === "suit" && <path d="M171 560 C188 574 207 581 230 586 C253 581 272 574 289 560 L280 621 239 621 230 586 221 621 180 621Z" fill="#272c33"/>}
        <path d="M148 291 C169 281 194 279 212 287M248 287 C266 279 291 281 312 291" stroke="rgba(255,255,255,.1)" fill="none"/>
      </g>}
    </g>
  </svg>;
}

function MiniSilhouette({ type, option }: { type: GarmentKey; option: number }) {
  return <svg viewBox="0 0 120 88" aria-hidden="true"><rect width="120" height="88" rx="8" fill="rgba(255,255,255,.015)"/>
    {type === "shirt" && <><path d="M35 19 49 13 60 23 71 13 85 19 96 36 84 42 81 76 39 76 36 42 24 36Z" fill="#d7d1c8"/><path d={option === 1 ? "M49 14 60 23 43 31M71 14 60 23 77 31" : option === 3 ? "M42 20Q60 11 78 20L71 31 60 25 49 31Z" : "M49 14 60 23 50 34M71 14 60 23 70 34"} stroke="#756d63" fill="none" strokeWidth="2"/></>}
    {type === "trouser" && <><path d="M39 12H81L75 78H62L60 34 58 78H45Z" fill="#9ba5b4"/>{option > 0 && <path d="M49 14 55 36M71 14 65 36" stroke="#4e5a69"/>}{option === 2 && <path d="M44 14 51 34M76 14 69 34" stroke="#4e5a69"/>}</>}
    {(type === "suit" || type === "blazer") && <><path d="M34 20 49 13 60 27 71 13 86 20 98 37 86 43 82 77 61 69 59 69 38 77 34 43 22 37Z" fill="#8797aa"/><path d="M49 14 60 27 47 49M71 14 60 27 73 49" stroke="#d7dde5" fill="none"/><circle cx={option === 1 || option === 2 ? 54 : 60} cy="49" r="2" fill="#ece4d8"/>{(option === 1 || option === 2) && <circle cx="66" cy="49" r="2" fill="#ece4d8"/>}</>}
  </svg>;
}

export function HomeVisualExplorer() {
  const [active, setActive] = useState<GarmentKey>("shirt");
  const [option, setOption] = useState(0);
  const [color, setColor] = useState(palettes[0].value);
  const [fabricImage, setFabricImage] = useState<string | null>(null);
  const [fabricName, setFabricName] = useState<string | null>(null);
  const [repeat, setRepeat] = useState(118);
  const garment = useMemo(() => garments[active], [active]);

  function chooseGarment(key: GarmentKey) { setActive(key); setOption(0); setColor(key === "shirt" ? palettes[0].value : key === "trouser" ? palettes[1].value : palettes[2].value); }
  function uploadFabric(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { setFabricImage(String(reader.result)); setFabricName(file.name); }; reader.readAsDataURL(file); }
  function clearFabric() { setFabricImage(null); setFabricName(null); setRepeat(118); }

  return <section className="visualExplorer visualSharp" id="explore">
    <div className="explorerRail"><div className="railIntro"><span>LIVE VISUAL</span><p>One cloth. Four garment worlds.</p></div>
      {(Object.keys(garments) as GarmentKey[]).map((key, index) => <button key={key} className={active === key ? "active" : ""} onClick={() => chooseGarment(key)}><small>0{index + 1}</small><span>{garments[key].label}</span><b>↗</b></button>)}
      <Link href="/designer-brief" className="engineRailCard"><span>AI DESIGNER ENGINE</span><strong>Need the system to decide?</strong><p>Build the occasion brief first, then add your cloth.</p><b>Open Designer →</b></Link>
    </div>
    <div className="explorerStage">
      <div className="stageTop sharpStageTop"><div><span>{garment.eyebrow}</span><h2>{garment.label}</h2><p>{garment.copy}</p></div><div className="shotMeta"><span>FRONT</span><span>50MM</span><span>SOFTBOX L</span><b><i/> LIVE</b></div></div>
      <div className="sharpWorkbench">
        <div className="visualCanvasColumn">
          <div className="mannequinFrame premiumProductFrame sharpProductFrame"><div className="studioLight studioLightA"/><div className="studioLight studioLightB"/><RealisticForm active={active} color={color} fabricImage={fabricImage} option={option} repeat={repeat}/><div className="productFormCaption"><span>LLINEN EARTH / DIGITAL FIT FORM</span><b>{fabricImage ? `Mapped from ${fabricName}` : `${palettes.find(p => p.value === color)?.name || "Fabric"} · simulated weave`}</b></div><div className="clarityTag"><span>01</span><p>Texture + fold + seam<br/>kept visible together.</p></div></div>
          <div className="referenceFilmstrip">{references.map((ref, index) => <article key={ref.title} className="referenceFrame" style={{ backgroundImage: `linear-gradient(180deg,rgba(2,7,17,.03),rgba(2,7,17,.76)),url('${ref.image}')` }}><span>0{index + 1} · {ref.label}</span><strong>{ref.title}</strong></article>)}</div>
        </div>
        <div className="sharpControls">
          <section className="controlBlock fabricMappingBlock"><div className="controlTitle"><div><span>YOUR FABRIC</span><strong>Map the real cloth</strong></div>{fabricImage && <button onClick={clearFabric}>Reset</button>}</div>
            <label className={fabricImage ? "fabricDrop hasFabric" : "fabricDrop"}><input type="file" accept="image/*" onChange={uploadFabric}/>{fabricImage ? <><img src={fabricImage} alt="Uploaded fabric preview"/><div><b>{fabricName}</b><span>Applied live to garment</span></div></> : <><div className="fabricDropIcon">＋</div><div><b>Upload cloth photo</b><span>Flat, evenly lit, close-up image works best</span></div></>}</label>
            {fabricImage && <div className="fabricScale"><div><span>PATTERN SCALE</span><b>{repeat}px</b></div><input aria-label="Fabric pattern scale" type="range" min="64" max="210" value={repeat} onChange={e => setRepeat(Number(e.target.value))}/></div>}
          </section>
          <section className="controlBlock"><div className="controlTitle"><div><span>STYLE DETAIL</span><strong>{garment.options[option].name}</strong></div><em>{String(option + 1).padStart(2,"0")}/04</em></div>
            <div className="sharpOptionGrid">{garment.options.map((item, index) => <button key={item.name} className={option === index ? "selected" : ""} onClick={() => setOption(index)}><MiniSilhouette type={active} option={index}/><span>{item.name}</span><small>{item.detail}</small><em>{item.note}</em></button>)}</div>
          </section>
          <section className="controlBlock toneBlock"><div className="controlTitle"><div><span>SIMULATED CLOTH</span><strong>{fabricImage ? "Hidden while real cloth is active" : "Choose a base tone"}</strong></div></div><div className="sharpSwatches">{palettes.map(palette => <button disabled={Boolean(fabricImage)} key={palette.value} className={color === palette.value ? "selected" : ""} style={{ background: palette.value }} onClick={() => setColor(palette.value)} aria-label={palette.name}><span>{palette.name}</span></button>)}</div></section>
          <div className="visualTruth"><span>VISUAL TRUTH</span><p>This is a high-clarity design preview, not a measurement or final-fit simulation. Final drape changes with fabric weight, construction and body measurements.</p></div>
        </div>
      </div>
    </div>
  </section>;
}
