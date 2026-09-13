"use client";

import { useId } from "react";

export type ShirtStyle = "classic" | "slim" | "buttonDown" | "cuban" | "mandarin";
export type TrouserStyle = "straight" | "tapered" | "relaxed" | "wide" | "bell";
export type LayerStyle = "none" | "suit" | "blazer";
export type MannequinView = "front" | "threeQuarter" | "back";

export function AtelierMannequin({
  shirtColor = "#f2eee6",
  trouserColor = "#b8aa97",
  layerColor = "#14243b",
  shirtTexture = null,
  trouserTexture = null,
  shirtStyle = "classic",
  trouserStyle = "straight",
  layerStyle = "none",
  view = "front",
  compact = false,
}: {
  shirtColor?: string;
  trouserColor?: string;
  layerColor?: string;
  shirtTexture?: string | null;
  trouserTexture?: string | null;
  shirtStyle?: ShirtStyle;
  trouserStyle?: TrouserStyle;
  layerStyle?: LayerStyle;
  view?: MannequinView;
  compact?: boolean;
}) {
  const rawId = useId().replace(/:/g, "");
  const id = `atelier-${rawId}`;
  const shirtFill = shirtTexture ? `url(#${id}-shirtTexture)` : shirtColor;
  const trouserFill = trouserTexture ? `url(#${id}-trouserTexture)` : trouserColor;
  const isBack = view === "back";
  const threeQuarter = view === "threeQuarter";

  const shirtWidth = shirtStyle === "slim" ? 164 : shirtStyle === "cuban" ? 188 : 178;
  const shirtLeft = 300 - shirtWidth / 2;
  const shirtRight = 300 + shirtWidth / 2;
  const waistLeft = shirtStyle === "relaxed" ? shirtLeft + 4 : shirtLeft + 18;
  const waistRight = shirtStyle === "relaxed" ? shirtRight - 4 : shirtRight - 18;
  const shirtBody = `M${shirtLeft} 276 Q300 244 ${shirtRight} 276 L${waistRight} 448 Q300 462 ${waistLeft} 448 Z`;

  const pant = (() => {
    switch (trouserStyle) {
      case "tapered": return "M214 428 Q300 414 386 428 L366 790 L320 790 L300 510 L280 790 L234 790 Z";
      case "relaxed": return "M205 428 Q300 412 395 428 L388 792 L326 792 L300 514 L274 792 L212 792 Z";
      case "wide": return "M198 428 Q300 410 402 428 L410 794 L330 794 L300 520 L270 794 L190 794 Z";
      case "bell": return "M211 428 Q300 414 389 428 L362 632 L398 796 L318 796 L300 520 L282 796 L202 796 L238 632 Z";
      default: return "M210 428 Q300 414 390 428 L382 792 L322 792 L300 514 L278 792 L218 792 Z";
    }
  })();

  const modelTransform = threeQuarter ? "translate(20 0) skewY(-1)" : undefined;

  return (
    <svg className={`atelierFullMannequin${compact ? " compact" : ""}`} viewBox="0 0 600 900" role="img" aria-label="LLinen Earth faceless atelier mannequin outfit preview">
      <defs>
        <linearGradient id={`${id}-studio`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8d7b66"/><stop offset=".55" stopColor="#71614f"/><stop offset="1" stopColor="#aa9983"/></linearGradient>
        <linearGradient id={`${id}-form`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff"/><stop offset=".42" stopColor="#ece8df"/><stop offset="1" stopColor="#cfc9bf"/></linearGradient>
        <linearGradient id={`${id}-clothLight`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".3"/><stop offset=".45" stopColor="#fff" stopOpacity=".03"/><stop offset="1" stopColor="#000" stopOpacity=".18"/></linearGradient>
        <filter id={`${id}-shadow`} x="-30%" y="-20%" width="160%" height="160%"><feDropShadow dx="8" dy="14" stdDeviation="14" floodColor="#201a15" floodOpacity=".32"/></filter>
        {shirtTexture && <pattern id={`${id}-shirtTexture`} width="92" height="92" patternUnits="userSpaceOnUse"><image href={shirtTexture} width="92" height="92" preserveAspectRatio="xMidYMid slice"/></pattern>}
        {trouserTexture && <pattern id={`${id}-trouserTexture`} width="96" height="96" patternUnits="userSpaceOnUse"><image href={trouserTexture} width="96" height="96" preserveAspectRatio="xMidYMid slice"/></pattern>}
      </defs>

      <rect width="600" height="900" fill={`url(#${id}-studio)`}/>
      <rect x="0" y="0" width="58" height="900" fill="#3b281b"/><rect x="542" y="0" width="58" height="900" fill="#3b281b"/>
      <path d="M92 720V220 Q92 70 300 70 Q508 70 508 220V720" fill="#5e5143" stroke="#d8b377" strokeWidth="4" opacity=".97"/>
      <path d="M98 720V225 Q98 80 300 80 Q502 80 502 225V720" fill="none" stroke="#ffd596" strokeOpacity=".45" strokeWidth="10"/>
      <rect x="58" y="720" width="484" height="180" fill="#b6a690"/>
      <ellipse cx="300" cy="827" rx="138" ry="32" fill="#111" opacity=".98"/><rect x="162" y="797" width="276" height="31" fill="#171717"/><ellipse cx="300" cy="797" rx="138" ry="31" fill="#2b2b2b"/>

      <g transform={modelTransform} filter={`url(#${id}-shadow)`}>
        <ellipse cx="300" cy="170" rx="55" ry="68" fill={`url(#${id}-form)`}/>
        <path d="M275 222 L275 260 Q300 278 325 260 L325 222" fill={`url(#${id}-form)`}/>
        <path d="M218 280 Q185 318 188 387 L201 512 Q203 530 221 528 L235 523 L235 312Z" fill={`url(#${id}-form)`}/>
        <path d="M382 280 Q415 318 412 387 L399 512 Q397 530 379 528 L365 523 L365 312Z" fill={`url(#${id}-form)`}/>
        <path d="M214 444 L214 806 L274 806 L300 526 L326 806 L386 806 L386 444Z" fill={`url(#${id}-form)`}/>
        <path d="M184 528 q20 -12 40 0 l-7 30 q-16 20 -34 2z" fill={`url(#${id}-form)`}/><path d="M416 528 q-20 -12 -40 0 l7 30 q16 20 34 2z" fill={`url(#${id}-form)`}/>
        <path d="M220 803 h58 v30 h-79 q-10 -14 21 -30Z" fill="#f8f8f5" stroke="#c7c5c0"/><path d="M322 803 h58 q31 16 21 30 h-79Z" fill="#f8f8f5" stroke="#c7c5c0"/>

        <g>
          <path d={pant} fill={trouserFill}/><path d={pant} fill={`url(#${id}-clothLight)`} opacity=".65"/>
          {!isBack && <><path d="M300 435V534" stroke="#2d2a26" strokeOpacity=".34"/><circle cx="300" cy="441" r="4" fill="#3b342c" opacity=".68"/>
          <path d="M242 454 Q263 466 280 470 M358 454 Q337 466 320 470" stroke="#fff" strokeOpacity=".15" fill="none"/>
          <path d="M257 452V760 M343 452V760" stroke="#111" strokeOpacity=".08"/>
          {trouserStyle === "relaxed" || trouserStyle === "wide" ? <path d="M255 438 Q260 476 281 520 M345 438 Q340 476 319 520" stroke="#191715" strokeOpacity=".26" fill="none"/> : null}</>}
        </g>

        <g>
          <path d={shirtBody} fill={shirtFill}/><path d={shirtBody} fill={`url(#${id}-clothLight)`} opacity=".56"/>
          <path d={`M${shirtLeft} 286 Q194 310 203 365 L214 455 L244 448 L238 324Z`} fill={shirtFill}/><path d={`M${shirtRight} 286 Q406 310 397 365 L386 455 L356 448 L362 324Z`} fill={shirtFill}/>
          {!isBack && <>
            {shirtStyle === "mandarin" ? <path d="M273 268 Q300 280 327 268 L325 296 Q300 307 275 296Z" fill={shirtFill} stroke="#fff" strokeOpacity=".22"/> : shirtStyle === "cuban" ? <><path d="M254 270 L300 292 L270 326 L239 286Z" fill={shirtFill}/><path d="M346 270 L300 292 L330 326 L361 286Z" fill={shirtFill}/></> : <><path d="M258 267 L300 292 L274 322 L245 281Z" fill={shirtFill}/><path d="M342 267 L300 292 L326 322 L355 281Z" fill={shirtFill}/></>}
            <path d="M300 292V444" stroke="#2b2926" strokeOpacity=".28"/>{[320,350,380,410].map(y=><circle key={y} cx="300" cy={y} r="2.5" fill="#554d43" opacity=".72"/>)}
            {shirtStyle === "buttonDown" && <><circle cx="267" cy="296" r="2.3" fill="#554d43"/><circle cx="333" cy="296" r="2.3" fill="#554d43"/></>}
          </>}
        </g>

        {layerStyle !== "none" && <g>
          <path d="M216 276 Q250 252 300 294 Q350 252 384 276 L405 490 Q372 528 330 540 L300 463 L270 540 Q228 528 195 490Z" fill={layerColor}/>
          <path d="M216 276 Q250 252 300 294 Q350 252 384 276 L405 490 Q372 528 330 540 L300 463 L270 540 Q228 528 195 490Z" fill={`url(#${id}-clothLight)`} opacity=".55"/>
          {!isBack && <><path d="M245 278 L300 294 L270 385 L232 321Z" fill="#fff" fillOpacity=".11"/><path d="M355 278 L300 294 L330 385 L368 321Z" fill="#000" fillOpacity=".10"/>
            {layerStyle === "suit" ? <><circle cx="284" cy="420" r="4" fill="#111" opacity=".65"/><circle cx="284" cy="447" r="4" fill="#111" opacity=".65"/></> : <circle cx="300" cy="431" r="4" fill="#111" opacity=".65"/>}
            <path d="M230 462 h45 M325 462 h45" stroke="#fff" strokeOpacity=".18"/></>}
        </g>}
      </g>
    </svg>
  );
}
