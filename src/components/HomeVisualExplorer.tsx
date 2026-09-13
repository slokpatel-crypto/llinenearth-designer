"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type GarmentKey = "shirt" | "trouser" | "suit" | "blazer";

type GarmentConfig = {
  label: string;
  eyebrow: string;
  copy: string;
  options: string[];
};

const garments: Record<GarmentKey, GarmentConfig> = {
  shirt: {
    label: "Shirts",
    eyebrow: "01 / SHIRT STUDIO",
    copy: "Collar, cuff, fit and fabric character — shown on a clean headless atelier form so the garment stays the focus.",
    options: ["Spread collar", "Cutaway collar", "Button-down", "Cuban collar"],
  },
  trouser: {
    label: "Trousers",
    eyebrow: "02 / TROUSER STUDIO",
    copy: "Rise, pleat, taper and break are compared on a neutral lower-body form for fast visual clarity.",
    options: ["Flat front", "Single pleat", "Double pleat", "Gurkha"],
  },
  suit: {
    label: "Suits",
    eyebrow: "03 / SUIT STUDIO",
    copy: "Single-breasted, double-breasted and formal directions shown on the same faceless tailoring form.",
    options: ["2-button SB", "Double-breasted", "Soft suit", "Dinner suit"],
  },
  blazer: {
    label: "Blazers",
    eyebrow: "04 / BLAZER STUDIO",
    copy: "Explore structure, lapel, pocket and styling details without a face or styling noise competing with the garment.",
    options: ["Soft blazer", "Structured blazer", "DB blazer", "Safari jacket"],
  },
};

const palettes = [
  { name: "Cream linen", value: "#ddd2c2" },
  { name: "Warm stone", value: "#a69c8f" },
  { name: "Midnight navy", value: "#14243b" },
  { name: "Charcoal", value: "#484b4f" },
  { name: "Black", value: "#171a1e" },
];

function ProductForm({ active, color }: { active: GarmentKey; color: string }) {
  const isJacket = active === "suit" || active === "blazer";

  if (active === "trouser") {
    return (
      <svg className="atelierMannequin lowerForm" viewBox="0 0 420 620" role="img" aria-label="Headless lower-body mannequin preview wearing selected trousers">
        <defs>
          <linearGradient id="lowerBody" x1="0" x2="1">
            <stop offset="0" stopColor="#aaa49c" />
            <stop offset=".48" stopColor="#e8e3dc" />
            <stop offset="1" stopColor="#918c85" />
          </linearGradient>
          <pattern id="trouserWeave" width="7" height="7" patternUnits="userSpaceOnUse">
            <path d="M0 2H7M0 5H7M2 0V7M5 0V7" stroke="rgba(255,255,255,.1)" strokeWidth=".45" />
          </pattern>
          <filter id="lowerShadow" x="-30%" y="-20%" width="160%" height="150%">
            <feDropShadow dx="0" dy="20" stdDeviation="18" floodColor="#000" floodOpacity=".38" />
          </filter>
        </defs>
        <ellipse cx="210" cy="581" rx="112" ry="18" fill="rgba(0,0,0,.34)" />
        <g filter="url(#lowerShadow)">
          <path d="M138 80 C153 58 177 48 210 48 C243 48 267 58 282 80 L290 178 254 553 218 553 210 243 202 553 166 553 130 178Z" fill="url(#lowerBody)" opacity=".9" />
          <path d="M128 103 C150 88 175 82 210 82 C245 82 270 88 292 103 L283 196 252 551 218 551 210 232 202 551 168 551 137 196Z" fill={color} />
          <path d="M128 103 C150 88 175 82 210 82 C245 82 270 88 292 103 L283 196 252 551 218 551 210 232 202 551 168 551 137 196Z" fill="url(#trouserWeave)" />
          <path d="M130 111 C172 123 248 123 290 111" stroke="rgba(255,255,255,.26)" strokeWidth="4" fill="none" />
          <path d="M175 120 C179 151 186 181 202 220M245 120 C241 151 234 181 218 220" stroke="rgba(8,13,20,.25)" strokeWidth="2" fill="none" />
          <path d="M164 192 C180 187 192 187 205 191M215 191 C228 187 240 187 256 192" stroke="rgba(255,255,255,.13)" fill="none" />
        </g>
      </svg>
    );
  }

  return (
    <svg className="atelierMannequin torsoForm" viewBox="0 0 420 620" role="img" aria-label={`Headless tailor form preview wearing selected ${active}`}>
      <defs>
        <linearGradient id="formShade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0ece5" />
          <stop offset=".46" stopColor="#c8c1b7" />
          <stop offset="1" stopColor="#8f8a84" />
        </linearGradient>
        <linearGradient id="garmentLight" x1="0" y1="0" x2="1" y2=".8">
          <stop offset="0" stopColor="rgba(255,255,255,.22)" />
          <stop offset=".42" stopColor="rgba(255,255,255,.04)" />
          <stop offset="1" stopColor="rgba(0,0,0,.17)" />
        </linearGradient>
        <pattern id="fineLinen" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 1.5H6M0 4.5H6M1.5 0V6M4.5 0V6" stroke="rgba(255,255,255,.10)" strokeWidth=".38" />
          <path d="M0 3H6M3 0V6" stroke="rgba(20,24,30,.055)" strokeWidth=".28" />
        </pattern>
        <filter id="torsoShadow" x="-35%" y="-25%" width="170%" height="165%">
          <feDropShadow dx="-8" dy="15" stdDeviation="18" floodColor="#000" floodOpacity=".42" />
        </filter>
      </defs>

      <ellipse cx="210" cy="558" rx="113" ry="19" fill="rgba(0,0,0,.34)" />
      <g filter="url(#torsoShadow)">
        {/* clean crop at collarbone: no head and no visible neck joint */}
        <path d="M153 104 C166 86 185 78 210 78 C235 78 254 86 267 104 C288 114 310 130 325 153 L300 400 C292 457 266 494 210 510 C154 494 128 457 120 400 L95 153 C110 130 132 114 153 104Z" fill="url(#formShade)" />
        <path d="M102 160 C72 176 58 205 63 258 L77 353 C80 372 101 369 104 350 L104 238 128 181Z" fill="url(#formShade)" />
        <path d="M318 160 C348 176 362 205 357 258 L343 353 C340 372 319 369 316 350 L316 238 292 181Z" fill="url(#formShade)" />

        {active === "shirt" && <g>
          <path d="M146 112 L180 92 210 116 240 92 274 112 300 426 C287 470 258 493 210 505 C162 493 133 470 120 426Z" fill={color} />
          <path d="M102 162 C78 177 70 207 75 259 L87 337 109 335 118 226 143 126Z" fill={color} />
          <path d="M318 162 C342 177 350 207 345 259 L333 337 311 335 302 226 277 126Z" fill={color} />
          <path d="M146 112 L180 92 210 116 240 92 274 112 300 426 C287 470 258 493 210 505 C162 493 133 470 120 426Z" fill="url(#fineLinen)" />
          <path d="M102 162 C78 177 70 207 75 259 L87 337 109 335 118 226 143 126Z" fill="url(#fineLinen)" />
          <path d="M318 162 C342 177 350 207 345 259 L333 337 311 335 302 226 277 126Z" fill="url(#fineLinen)" />
          <path d="M146 112 L180 92 210 116 188 146 164 109Z" fill="rgba(255,255,255,.22)" />
          <path d="M274 112 L240 92 210 116 232 146 256 109Z" fill="rgba(0,0,0,.09)" />
          <path d="M210 116V488" stroke="rgba(18,23,30,.27)" strokeWidth="1.8" />
          {[176,218,260,302,344,386,428].map(y => <circle key={y} cx="210" cy={y} r="2.5" fill="rgba(20,24,30,.38)" />)}
          <path d="M130 258 C154 250 176 247 195 251M225 251 C244 247 266 250 290 258" stroke="rgba(255,255,255,.08)" fill="none" />
          <path d="M137 388 C164 380 183 381 203 387M217 387 C237 381 256 380 283 388" stroke="rgba(17,22,29,.08)" fill="none" />
          <rect x="73" y="318" width="39" height="18" rx="2" fill="rgba(255,255,255,.08)" />
          <rect x="308" y="318" width="39" height="18" rx="2" fill="rgba(0,0,0,.07)" />
        </g>}

        {isJacket && <g>
          <path d="M144 112 L177 94 210 128 243 94 276 112 304 438 C284 474 253 496 210 507 C167 496 136 474 116 438Z" fill={color} />
          <path d="M101 162 C76 177 70 208 75 280 L87 350 111 346 119 227 145 128Z" fill={color} />
          <path d="M319 162 C344 177 350 208 345 280 L333 350 309 346 301 227 275 128Z" fill={color} />
          <path d="M144 112 L177 94 210 128 243 94 276 112 304 438 C284 474 253 496 210 507 C167 496 136 474 116 438Z" fill="url(#fineLinen)" />
          <path d="M144 112 L177 94 210 128 180 230 150 126Z" fill="rgba(255,255,255,.12)" />
          <path d="M276 112 L243 94 210 128 240 230 270 126Z" fill="rgba(0,0,0,.12)" />
          <path d="M210 128 L210 476" stroke="rgba(6,12,19,.34)" strokeWidth="2" />
          <circle cx="210" cy="278" r="3.2" fill="rgba(245,239,228,.58)" />
          <circle cx="210" cy="315" r="3.2" fill="rgba(245,239,228,.58)" />
          <path d="M143 344 L183 350 181 371 145 367Z" fill="rgba(0,0,0,.08)" />
          <path d="M277 344 L237 350 239 371 275 367Z" fill="rgba(0,0,0,.10)" />
          {active === "suit" && <path d="M158 492 C175 505 192 511 210 514 C228 511 245 505 262 492 L253 548 218 548 210 514 202 548 167 548Z" fill="#282d34" />}
        </g>}

        <path d="M144 112 C163 102 183 96 210 96 C237 96 257 102 276 112" stroke="rgba(255,255,255,.11)" fill="none" />
        <path d="M122 431 C151 449 178 457 210 459 C242 457 269 449 298 431" stroke="rgba(0,0,0,.08)" fill="none" />
      </g>
    </svg>
  );
}

export function HomeVisualExplorer() {
  const [active, setActive] = useState<GarmentKey>("shirt");
  const [option, setOption] = useState(0);
  const [color, setColor] = useState(palettes[0].value);
  const garment = useMemo(() => garments[active], [active]);

  const chooseGarment = (key: GarmentKey) => {
    setActive(key);
    setOption(0);
    setColor(key === "shirt" ? palettes[0].value : key === "trouser" ? palettes[1].value : palettes[2].value);
  };

  return <section className="visualExplorer" id="explore">
    <div className="explorerRail">
      <div className="railIntro"><span>EXPLORE</span><p>See the options first. Decide with clarity.</p></div>
      {(Object.keys(garments) as GarmentKey[]).map((key, index) => <button key={key} className={active === key ? "active" : ""} onClick={() => chooseGarment(key)}>
        <small>0{index + 1}</small><span>{garments[key].label}</span><b>↗</b>
      </button>)}
      <Link href="/designer" className="engineRailCard"><span>AI DESIGNER ENGINE</span><strong>Let the designer decide.</strong><p>Fabric + occasion + fit + aesthetic → complete outfit directions.</p><b>Enter Designer →</b></Link>
    </div>

    <div className="explorerStage">
      <div className="stageTop"><div><span>{garment.eyebrow}</span><h2>{garment.label}</h2><p>{garment.copy}</p></div><div className="liveBadge"><i /> LIVE VISUAL</div></div>
      <div className="stageBody">
        <div className="mannequinFrame premiumProductFrame">
          <ProductForm active={active} color={color} />
          <div className="productFormCaption"><span>HEADLESS ATELIER FORM</span><b>{active === "shirt" ? "Cream linen · natural weave" : `${garment.label} · live fabric tone`}</b></div>
          <div className="viewSwitch"><button className="selected">Front</button><button>Side</button><button>Back</button></div>
        </div>
        <div className="optionPanel">
          <div className="optionTitle"><span>STYLE OPTIONS</span><strong>{garment.options[option]}</strong></div>
          <div className="optionTiles">{garment.options.map((item, index) => <button key={item} className={option === index ? "selected" : ""} onClick={() => setOption(index)}><div className={`miniGarment mini-${active}`}><span /></div><b>{item}</b><small>{index === option ? "Selected" : "Preview"}</small></button>)}</div>
          <div className="swatchPanel"><span>APPLY FABRIC TONE</span><div>{palettes.map(p => <button key={p.name} aria-label={p.name} title={p.name} className={color === p.value ? "selected" : ""} style={{ background: p.value }} onClick={() => setColor(p.value)} />)}</div><p>The mannequin is intentionally neutral and headless. The next production layer can map an uploaded fabric texture and pattern onto this locked garment silhouette.</p></div>
        </div>
      </div>
    </div>
  </section>;
}
