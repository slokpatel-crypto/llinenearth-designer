"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type GarmentKey = "shirt" | "trouser" | "suit" | "blazer";

type GarmentConfig = {
  label: string;
  eyebrow: string;
  copy: string;
  options: string[];
  photo: string;
};

const garments: Record<GarmentKey, GarmentConfig> = {
  shirt: {
    label: "Shirts",
    eyebrow: "01 / SHIRT STUDIO",
    copy: "Collar, cuff, fit and fabric character — considered together, not as isolated options.",
    options: ["Spread collar", "Cutaway collar", "Button-down", "Cuban collar"],
    photo: "https://images.pexels.com/photos/6764950/pexels-photo-6764950.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
  trouser: {
    label: "Trousers",
    eyebrow: "02 / TROUSER STUDIO",
    copy: "Rise, pleat, taper and break are shown on the same mannequin for clearer comparison.",
    options: ["Flat front", "Single pleat", "Double pleat", "Gurkha"],
    photo: "https://images.pexels.com/photos/6766233/pexels-photo-6766233.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
  suit: {
    label: "Suits",
    eyebrow: "03 / SUIT STUDIO",
    copy: "Single-breasted, double-breasted and formal directions judged against cloth and occasion.",
    options: ["2-button SB", "Double-breasted", "Soft suit", "Dinner suit"],
    photo: "https://images.pexels.com/photos/6764929/pexels-photo-6764929.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
  blazer: {
    label: "Blazers",
    eyebrow: "04 / BLAZER STUDIO",
    copy: "Explore structure, lapel, pocket and styling options before sending the design to the atelier.",
    options: ["Soft blazer", "Structured blazer", "DB blazer", "Safari jacket"],
    photo: "https://images.pexels.com/photos/6764919/pexels-photo-6764919.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
};

const palettes = [
  { name: "Natural linen", value: "#d9cfbf" },
  { name: "Sage", value: "#6f7968" },
  { name: "Midnight", value: "#14243b" },
  { name: "Stone", value: "#90877d" },
  { name: "Black", value: "#171a1e" },
];

function Mannequin({ active, color }: { active: GarmentKey; color: string }) {
  const isJacket = active === "suit" || active === "blazer";
  return (
    <svg className="atelierMannequin" viewBox="0 0 360 700" role="img" aria-label={`Mannequin preview wearing selected ${active}`}>
      <defs>
        <linearGradient id="bodyShade" x1="0" x2="1">
          <stop offset="0" stopColor="#d8d2c9" />
          <stop offset=".45" stopColor="#f5f1ea" />
          <stop offset="1" stopColor="#bbb5ac" />
        </linearGradient>
        <pattern id="linenWeave" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 2H8M0 6H8M2 0V8M6 0V8" stroke="rgba(255,255,255,.12)" strokeWidth=".55" />
        </pattern>
        <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="12" stdDeviation="14" floodColor="#000" floodOpacity=".32" />
        </filter>
      </defs>

      <ellipse cx="180" cy="665" rx="94" ry="20" fill="rgba(0,0,0,.34)" />
      <g filter="url(#softShadow)">
        <ellipse cx="180" cy="80" rx="48" ry="60" fill="url(#bodyShade)" />
        <path d="M148 127 C151 158 145 171 126 181 L234 181 C215 171 209 158 212 127Z" fill="url(#bodyShade)" />
        <path d="M126 178 C88 193 71 232 72 300 L89 417 C92 436 111 432 113 414 L112 310 135 237Z" fill="url(#bodyShade)" />
        <path d="M234 178 C272 193 289 232 288 300 L271 417 C268 436 249 432 247 414 L248 310 225 237Z" fill="url(#bodyShade)" />
        <path d="M137 385 L168 385 164 632 C164 652 137 652 136 632Z" fill="url(#bodyShade)" />
        <path d="M192 385 L223 385 224 632 C223 652 196 652 196 632Z" fill="url(#bodyShade)" />
        <path d="M132 174 C147 163 162 159 180 159 C198 159 213 163 228 174 L241 386 119 386Z" fill="url(#bodyShade)" />
      </g>

      {active === "shirt" && <g>
        <path d="M128 175 L158 160 180 178 202 160 232 175 242 370 118 370Z" fill={color} />
        <path d="M128 175 L158 160 180 178 202 160 232 175 242 370 118 370Z" fill="url(#linenWeave)" />
        <path d="M158 160 L180 178 168 203 147 171Z" fill="rgba(255,255,255,.28)" />
        <path d="M202 160 L180 178 192 203 213 171Z" fill="rgba(255,255,255,.18)" />
        <path d="M180 180V362" stroke="rgba(20,25,32,.32)" strokeWidth="2" />
        {[215,245,275,305,335].map(y => <circle key={y} cx="180" cy={y} r="2.3" fill="rgba(20,25,32,.48)" />)}
        <path d="M127 179 C97 194 89 225 91 302 L113 304 128 220Z" fill={color} /><path d="M233 179 C263 194 271 225 269 302 L247 304 232 220Z" fill={color} />
      </g>}

      {active === "trouser" && <g>
        <path d="M121 360 L239 360 226 635 194 635 180 420 166 635 134 635Z" fill={color} />
        <path d="M121 360 L239 360 226 635 194 635 180 420 166 635 134 635Z" fill="url(#linenWeave)" />
        <path d="M120 361H240" stroke="rgba(255,255,255,.34)" strokeWidth="4" />
        <path d="M160 365 C164 391 168 408 175 420M200 365 C196 391 192 408 185 420" stroke="rgba(15,20,28,.28)" fill="none" />
      </g>}

      {isJacket && <g>
        {active === "suit" && <path d="M121 360 L239 360 226 635 194 635 180 420 166 635 134 635Z" fill="#343940" />}
        <path d="M127 174 L158 160 180 185 202 160 233 174 247 383 190 392 180 360 170 392 113 383Z" fill={color} />
        <path d="M127 174 L158 160 180 185 202 160 233 174 247 383 190 392 180 360 170 392 113 383Z" fill="url(#linenWeave)" />
        <path d="M158 162 L180 185 159 255 136 188Z" fill="rgba(255,255,255,.17)" /><path d="M202 162 L180 185 201 255 224 188Z" fill="rgba(0,0,0,.14)" />
        <path d="M180 185V362" stroke="rgba(7,13,20,.42)" strokeWidth="2" />
        <circle cx="180" cy="287" r="3" fill="rgba(250,245,235,.65)" /><circle cx="180" cy="310" r="3" fill="rgba(250,245,235,.65)" />
        <path d="M128 179 C96 194 88 230 92 333 L116 333 132 218Z" fill={color} /><path d="M232 179 C264 194 272 230 268 333 L244 333 228 218Z" fill={color} />
      </g>}

      <path d="M118 370H242" stroke="rgba(255,255,255,.11)" />
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
        <div className="mannequinFrame"><Mannequin active={active} color={color} /><div className="viewSwitch"><button className="selected">Front</button><button>Side</button><button>Back</button></div></div>
        <div className="optionPanel">
          <div className="optionTitle"><span>STYLE OPTIONS</span><strong>{garment.options[option]}</strong></div>
          <div className="optionTiles">{garment.options.map((item, index) => <button key={item} className={option === index ? "selected" : ""} onClick={() => setOption(index)}><div className={`miniGarment mini-${active}`}><span /></div><b>{item}</b><small>{index === option ? "Selected" : "Preview"}</small></button>)}</div>
          <div className="swatchPanel"><span>APPLY FABRIC TONE</span><div>{palettes.map(p => <button key={p.name} aria-label={p.name} title={p.name} className={color === p.value ? "selected" : ""} style={{ background: p.value }} onClick={() => setColor(p.value)} />)}</div><p>Prototype visual: the final system will map uploaded cloth texture and pattern onto the locked garment.</p></div>
        </div>
      </div>
    </div>
  </section>;
}
