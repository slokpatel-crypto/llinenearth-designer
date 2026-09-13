"use client";

import Link from "next/link";
import { ChangeEvent, useMemo, useState } from "react";

type GarmentKey = "shirt" | "trouser" | "suit" | "blazer";

type GarmentConfig = {
  label: string;
  eyebrow: string;
  copy: string;
  options: string[];
};

const garments: Record<GarmentKey, GarmentConfig> = {
  shirt: { label: "Shirts", eyebrow: "01 / SHIRT STUDIO", copy: "Collar, cuff and cloth are shown together on a studio-lit headless form.", options: ["Spread collar", "Cutaway collar", "Button-down", "Cuban collar"] },
  trouser: { label: "Trousers", eyebrow: "02 / TROUSER STUDIO", copy: "Pleat, rise and taper stay visible while the real fabric surface is mapped onto the trouser.", options: ["Flat front", "Single pleat", "Double pleat", "Gurkha"] },
  suit: { label: "Suits", eyebrow: "03 / SUIT STUDIO", copy: "See lapel, button stance and cloth character on one consistent tailoring form.", options: ["2-button SB", "Double-breasted", "Soft suit", "Dinner suit"] },
  blazer: { label: "Blazers", eyebrow: "04 / BLAZER STUDIO", copy: "Compare soft, structured and double-breasted directions with fabric texture kept visible.", options: ["Soft blazer", "Structured blazer", "DB blazer", "Safari jacket"] },
};

const palettes = [
  { name: "Cream linen", value: "#ddd2c2" },
  { name: "Warm stone", value: "#a69c8f" },
  { name: "Midnight navy", value: "#14243b" },
  { name: "Charcoal", value: "#484b4f" },
  { name: "Black", value: "#171a1e" },
];

function FabricDefs({ fabricImage }: { fabricImage: string | null }) {
  return <defs>
    <linearGradient id="formShade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#f2eee7" />
      <stop offset=".42" stopColor="#c8c1b8" />
      <stop offset="1" stopColor="#817d77" />
    </linearGradient>
    <linearGradient id="clothLight" x1="0" y1="0" x2="1" y2=".85">
      <stop offset="0" stopColor="rgba(255,255,255,.34)" />
      <stop offset=".28" stopColor="rgba(255,255,255,.09)" />
      <stop offset=".67" stopColor="rgba(0,0,0,.05)" />
      <stop offset="1" stopColor="rgba(0,0,0,.3)" />
    </linearGradient>
    <pattern id="wovenBase" width="5" height="5" patternUnits="userSpaceOnUse">
      <path d="M0 1H5M0 3.7H5M1 0V5M3.7 0V5" stroke="rgba(255,255,255,.08)" strokeWidth=".35" />
      <path d="M0 2.4H5M2.4 0V5" stroke="rgba(0,0,0,.045)" strokeWidth=".3" />
    </pattern>
    {fabricImage && <pattern id="uploadedFabric" width="112" height="112" patternUnits="userSpaceOnUse"><image href={fabricImage} x="0" y="0" width="112" height="112" preserveAspectRatio="xMidYMid slice" /></pattern>}
    <filter id="studioShadow" x="-40%" y="-30%" width="180%" height="180%">
      <feDropShadow dx="-10" dy="20" stdDeviation="18" floodColor="#000" floodOpacity=".46" />
    </filter>
    <filter id="clothDepth" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency=".018 .11" numOctaves="2" seed="5" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.3" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>;
}

function RealisticForm({ active, color, fabricImage, option }: { active: GarmentKey; color: string; fabricImage: string | null; option: number }) {
  const fill = fabricImage ? "url(#uploadedFabric)" : color;
  const isJacket = active === "suit" || active === "blazer";
  const doubleBreasted = (active === "suit" && option === 1) || (active === "blazer" && option === 2);

  if (active === "trouser") {
    return <svg className="atelierMannequin realisticForm lowerForm" viewBox="0 0 460 700" role="img" aria-label="Real fabric trouser visualization">
      <FabricDefs fabricImage={fabricImage} />
      <ellipse cx="230" cy="650" rx="120" ry="22" fill="rgba(0,0,0,.4)" />
      <g filter="url(#studioShadow)">
        <path d="M153 95 C173 70 197 62 230 62 C263 62 287 70 307 95 L300 205 269 620 235 620 230 266 225 620 191 620 160 205Z" fill="url(#formShade)" />
        <g filter="url(#clothDepth)">
          <path d="M143 119 C170 99 195 94 230 94 C265 94 290 99 317 119 L303 224 269 620 235 620 230 260 225 620 191 620 157 224Z" fill={fill} />
          {!fabricImage && <path d="M143 119 C170 99 195 94 230 94 C265 94 290 99 317 119 L303 224 269 620 235 620 230 260 225 620 191 620 157 224Z" fill="url(#wovenBase)" />}
          <path d="M143 119 C170 99 195 94 230 94 C265 94 290 99 317 119 L303 224 269 620 235 620 230 260 225 620 191 620 157 224Z" fill="url(#clothLight)" opacity=".56" />
        </g>
        <path d="M147 129 C193 142 267 142 313 129" stroke="rgba(255,255,255,.3)" strokeWidth="4" fill="none" />
        {option > 0 && <path d="M191 133 C194 165 200 193 216 231M269 133 C266 165 260 193 244 231" stroke="rgba(10,14,20,.27)" strokeWidth="2" fill="none" />}
        {option === 2 && <path d="M176 132 C181 165 188 193 204 228M284 132 C279 165 272 193 256 228" stroke="rgba(10,14,20,.19)" strokeWidth="1.5" fill="none" />}
        {option === 3 && <><path d="M152 124 L190 151 176 168 145 140Z" fill="rgba(0,0,0,.16)"/><path d="M308 124 L270 151 284 168 315 140Z" fill="rgba(0,0,0,.16)"/></>}
        <path d="M172 271 C188 262 205 260 221 266M239 266 C255 260 272 262 288 271" stroke="rgba(255,255,255,.11)" fill="none" />
      </g>
    </svg>;
  }

  return <svg className="atelierMannequin realisticForm torsoForm" viewBox="0 0 460 700" role="img" aria-label={`Real fabric ${active} visualization`}>
    <FabricDefs fabricImage={fabricImage} />
    <ellipse cx="230" cy="630" rx="122" ry="22" fill="rgba(0,0,0,.4)" />
    <g filter="url(#studioShadow)">
      <path d="M165 126 C181 101 201 91 230 91 C259 91 279 101 295 126 C319 136 344 156 358 183 L330 462 C321 523 288 565 230 582 C172 565 139 523 130 462 L102 183 C116 156 141 136 165 126Z" fill="url(#formShade)" />
      <path d="M108 190 C76 209 63 244 69 306 L86 415 C89 437 113 433 116 411 L116 277 145 205Z" fill="url(#formShade)" />
      <path d="M352 190 C384 209 397 244 391 306 L374 415 C371 437 347 433 344 411 L344 277 315 205Z" fill="url(#formShade)" />

      {active === "shirt" && <g filter="url(#clothDepth)">
        <path d="M159 137 L196 108 230 133 264 108 301 137 332 488 C314 534 279 560 230 574 C181 560 146 534 128 488Z" fill={fill} />
        <path d="M109 192 C83 211 78 247 83 311 L98 397 123 393 132 266 158 151Z" fill={fill} />
        <path d="M351 192 C377 211 382 247 377 311 L362 397 337 393 328 266 302 151Z" fill={fill} />
        {!fabricImage && <><path d="M159 137 L196 108 230 133 264 108 301 137 332 488 C314 534 279 560 230 574 C181 560 146 534 128 488Z" fill="url(#wovenBase)"/><path d="M109 192 C83 211 78 247 83 311 L98 397 123 393 132 266 158 151Z" fill="url(#wovenBase)"/><path d="M351 192 C377 211 382 247 377 311 L362 397 337 393 328 266 302 151Z" fill="url(#wovenBase)"/></>}
        <path d="M159 137 L196 108 230 133 264 108 301 137 332 488 C314 534 279 560 230 574 C181 560 146 534 128 488Z" fill="url(#clothLight)" opacity=".52" />
      </g>}

      {active === "shirt" && <g>
        {option === 0 && <><path d="M159 137 L196 108 230 133 203 168 177 126Z" fill="rgba(255,255,255,.24)"/><path d="M301 137 L264 108 230 133 257 168 283 126Z" fill="rgba(0,0,0,.1)"/></>}
        {option === 1 && <><path d="M159 137 L196 108 230 133 197 158 172 126Z" fill="rgba(255,255,255,.23)"/><path d="M301 137 L264 108 230 133 263 158 288 126Z" fill="rgba(0,0,0,.1)"/></>}
        {option === 2 && <><path d="M163 136 L198 111 230 133 205 164 179 126Z" fill="rgba(255,255,255,.22)"/><path d="M297 136 L262 111 230 133 255 164 281 126Z" fill="rgba(0,0,0,.1)"/><circle cx="195" cy="146" r="2" fill="#5b5148"/><circle cx="265" cy="146" r="2" fill="#5b5148"/></>}
        {option === 3 && <path d="M165 137 C190 122 209 119 230 135 C251 119 270 122 295 137 L276 164 230 146 184 164Z" fill="rgba(255,255,255,.17)"/>}
        <path d="M230 133V556" stroke="rgba(18,23,30,.3)" strokeWidth="1.8" />
        {[194,238,282,326,370,414,458,502].map(y => <circle key={y} cx="230" cy={y} r="2.5" fill="rgba(20,24,30,.4)" />)}
        <path d="M146 306 C170 294 196 292 218 300M242 300 C264 292 290 294 314 306" stroke="rgba(255,255,255,.1)" fill="none" />
        <path d="M151 432 C176 422 198 423 219 431M241 431 C262 423 284 422 309 432" stroke="rgba(0,0,0,.09)" fill="none" />
      </g>}

      {isJacket && <g>
        <g filter="url(#clothDepth)">
          <path d="M157 137 L194 110 230 148 266 110 303 137 335 500 C312 543 277 565 230 578 C183 565 148 543 125 500Z" fill={fill}/>
          <path d="M108 192 C82 211 78 247 83 332 L98 410 124 406 134 266 159 151Z" fill={fill}/>
          <path d="M352 192 C378 211 382 247 377 332 L362 410 336 406 326 266 301 151Z" fill={fill}/>
          {!fabricImage && <path d="M157 137 L194 110 230 148 266 110 303 137 335 500 C312 543 277 565 230 578 C183 565 148 543 125 500Z" fill="url(#wovenBase)"/>}
          <path d="M157 137 L194 110 230 148 266 110 303 137 335 500 C312 543 277 565 230 578 C183 565 148 543 125 500Z" fill="url(#clothLight)" opacity=".55"/>
        </g>
        <path d="M194 112 L230 148 193 256 162 149Z" fill="rgba(255,255,255,.14)"/><path d="M266 112 L230 148 267 256 298 149Z" fill="rgba(0,0,0,.14)"/>
        {!doubleBreasted && <><path d="M230 148V536" stroke="rgba(5,10,16,.35)" strokeWidth="2"/><circle cx="230" cy="319" r="3.5" fill="rgba(245,239,228,.62)"/><circle cx="230" cy="359" r="3.5" fill="rgba(245,239,228,.62)"/></>}
        {doubleBreasted && <>{[210,250].map(x => <g key={x}><circle cx={x} cy="314" r="3.3" fill="rgba(245,239,228,.62)"/><circle cx={x} cy="354" r="3.3" fill="rgba(245,239,228,.62)"/></g>)}</>}
        <path d="M160 397 L205 404 202 429 162 424Z" fill="rgba(0,0,0,.1)"/><path d="M300 397 L255 404 258 429 298 424Z" fill="rgba(0,0,0,.12)"/>
        {active === "suit" && <path d="M174 558 C194 574 212 581 230 584 C248 581 266 574 286 558 L276 631 239 631 230 584 221 631 184 631Z" fill="#252a31"/>}
      </g>}
    </g>
  </svg>;
}

export function HomeVisualExplorer() {
  const [active, setActive] = useState<GarmentKey>("shirt");
  const [option, setOption] = useState(0);
  const [color, setColor] = useState(palettes[0].value);
  const [fabricImage, setFabricImage] = useState<string | null>(null);
  const garment = useMemo(() => garments[active], [active]);

  function chooseGarment(key: GarmentKey) {
    setActive(key);
    setOption(0);
    setColor(key === "shirt" ? palettes[0].value : key === "trouser" ? palettes[1].value : palettes[2].value);
  }

  function loadFabric(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFabricImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  return <section className="visualExplorer realisticExplorer" id="explore">
    <div className="explorerRail">
      <div className="railIntro"><span>LIVE VISUAL</span><p>Choose the garment. Then put the real cloth on it.</p></div>
      {(Object.keys(garments) as GarmentKey[]).map((key, index) => <button key={key} className={active === key ? "active" : ""} onClick={() => chooseGarment(key)}><small>0{index + 1}</small><span>{garments[key].label}</span><b>↗</b></button>)}
      <Link href="/designer-brief" className="engineRailCard"><span>NEED HELP CHOOSING?</span><strong>Use the Designer.</strong><p>Occasion + fabric + fit + aesthetic → outfit direction.</p><b>Open Designer →</b></Link>
    </div>

    <div className="explorerStage">
      <div className="stageTop"><div><span>{garment.eyebrow}</span><h2>{garment.label}</h2><p>{garment.copy}</p></div><div className="liveBadge"><i /> LIVE FABRIC MAP</div></div>
      <div className="stageBody">
        <div className="mannequinFrame premiumProductFrame photoLevelFrame">
          <RealisticForm active={active} color={color} fabricImage={fabricImage} option={option} />
          <div className="studioLight" />
          <div className="productFormCaption"><span>{fabricImage ? "REAL FABRIC PHOTO MAPPED" : "STUDIO FABRIC SIMULATION"}</span><b>{garment.options[option]}</b></div>
        </div>

        <div className="optionPanel">
          <label className="fabricUploadControl">
            <span>01 / YOUR FABRIC</span>
            <strong>{fabricImage ? "Fabric photo applied" : "Upload fabric photo"}</strong>
            <p>Use a straight, well-lit close-up. The image is tiled across the garment so the weave, checks, stripes and real colour remain visible.</p>
            <input type="file" accept="image/*" onChange={loadFabric} />
            <b>{fabricImage ? "Change fabric photo ↗" : "Choose fabric image ↗"}</b>
          </label>

          <div className="optionTitle"><span>02 / STYLE DETAIL</span><strong>{garment.options[option]}</strong></div>
          <div className="optionTiles compactOptionTiles">{garment.options.map((item, index) => <button key={item} className={option === index ? "selected" : ""} onClick={() => setOption(index)}><span className="optionNumber">0{index + 1}</span><b>{item}</b><small>{index === option ? "Applied to model" : "Preview"}</small></button>)}</div>

          {!fabricImage && <div className="swatchPanel"><span>03 / SIMULATED FABRIC TONE</span><div>{palettes.map(p => <button key={p.name} aria-label={p.name} title={p.name} className={color === p.value ? "selected" : ""} style={{ background: p.value }} onClick={() => setColor(p.value)} />)}</div><p>Upload a real cloth photo above for the most useful visual result.</p></div>}
          {fabricImage && <button className="removeFabric" onClick={() => setFabricImage(null)}>Remove fabric photo and return to simulated tones</button>}
        </div>
      </div>
    </div>
  </section>;
}
