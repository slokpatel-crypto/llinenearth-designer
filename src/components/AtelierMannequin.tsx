"use client";

import { useId } from "react";

export type ShirtStyle = "classic" | "slim" | "buttonDown" | "cuban" | "mandarin";
export type TrouserStyle = "straight" | "tapered" | "relaxed" | "wide" | "bell";
export type LayerStyle = "none" | "suit" | "blazer";
export type MannequinView = "front" | "threeQuarter" | "back";

type TrouserGeometry = {
  topLeft:number; topRight:number;
  leftOuter:number; leftInner:number;
  rightInner:number; rightOuter:number;
  leftKnee?:number; rightKnee?:number;
};

function trouserGeometry(style:TrouserStyle):TrouserGeometry {
  switch(style){
    case "tapered": return {topLeft:214,topRight:386,leftOuter:234,leftInner:280,rightInner:320,rightOuter:366};
    case "relaxed": return {topLeft:205,topRight:395,leftOuter:212,leftInner:274,rightInner:326,rightOuter:388};
    case "wide": return {topLeft:198,topRight:402,leftOuter:190,leftInner:270,rightInner:330,rightOuter:410};
    case "bell": return {topLeft:211,topRight:389,leftOuter:202,leftInner:282,rightInner:318,rightOuter:398,leftKnee:238,rightKnee:362};
    default: return {topLeft:210,topRight:390,leftOuter:218,leftInner:278,rightInner:322,rightOuter:382};
  }
}

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
  tucked = true,
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
  tucked?: boolean;
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
  const waistInset = shirtStyle === "slim" ? 24 : shirtStyle === "cuban" ? 9 : 18;
  const waistLeft = shirtLeft + waistInset;
  const waistRight = shirtRight - waistInset;
  const shirtBottom = tucked ? 456 : 486;

  // The torso deliberately leaves a real neck opening. The old path climbed behind
  // the neck and caused uploaded fabric to look pasted over the mannequin/collar.
  const shirtBody = `M${shirtLeft} 279 Q250 261 274 258 Q279 279 300 288 Q321 279 326 258 Q350 261 ${shirtRight} 279 L${waistRight} ${shirtBottom} Q300 ${shirtBottom + 8} ${waistLeft} ${shirtBottom} Z`;
  const leftSleeve = `M${shirtLeft + 8} 282 Q194 300 190 357 L198 486 Q199 510 218 517 L235 509 L238 327 Z`;
  const rightSleeve = `M${shirtRight - 8} 282 Q406 300 410 357 L402 486 Q401 510 382 517 L365 509 L362 327 Z`;

  const tg = trouserGeometry(trouserStyle);
  const leftLeg = trouserStyle === "bell"
    ? `M${tg.topLeft + 4} 454 Q258 446 300 460 L300 522 L${tg.leftInner} 796 L${tg.leftOuter} 796 L${tg.leftKnee} 632 Z`
    : `M${tg.topLeft + 4} 454 Q258 446 300 460 L300 522 L${tg.leftInner} 792 L${tg.leftOuter} 792 Z`;
  const rightLeg = trouserStyle === "bell"
    ? `M300 460 Q342 446 ${tg.topRight - 4} 454 L${tg.rightKnee} 632 L${tg.rightOuter} 796 L${tg.rightInner} 796 L300 522 Z`
    : `M300 460 Q342 446 ${tg.topRight - 4} 454 L${tg.rightOuter} 792 L${tg.rightInner} 792 L300 522 Z`;
  const waistband = `M${tg.topLeft} 428 Q300 414 ${tg.topRight} 428 L${tg.topRight - 4} 464 Q300 453 ${tg.topLeft + 4} 464 Z`;

  const modelTransform = threeQuarter ? "translate(20 0) skewY(-1)" : undefined;

  const clothLayer = (path:string, fill:string, lightOpacity=.48) => <>
    <path d={path} fill={fill}/>
    <path d={path} fill={`url(#${id}-clothLight)`} opacity={lightOpacity}/>
  </>;

  return (
    <svg className={`atelierFullMannequin${compact ? " compact" : ""}`} viewBox="0 0 600 900" role="img" aria-label="Linen Earth faceless atelier mannequin outfit preview">
      <defs>
        <linearGradient id={`${id}-studio`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f3f1ec"/><stop offset=".62" stopColor="#e8e5df"/><stop offset="1" stopColor="#d8d4cd"/></linearGradient>
        <linearGradient id={`${id}-form`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff"/><stop offset=".42" stopColor="#efede8"/><stop offset="1" stopColor="#d7d3cc"/></linearGradient>
        <linearGradient id={`${id}-clothLight`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".24"/><stop offset=".45" stopColor="#fff" stopOpacity=".025"/><stop offset="1" stopColor="#000" stopOpacity=".14"/></linearGradient>
        <filter id={`${id}-shadow`} x="-30%" y="-20%" width="160%" height="160%"><feDropShadow dx="5" dy="11" stdDeviation="12" floodColor="#6a6258" floodOpacity=".20"/></filter>
        {shirtTexture && <pattern id={`${id}-shirtTexture`} width="82" height="82" patternUnits="userSpaceOnUse"><image href={shirtTexture} width="82" height="82" preserveAspectRatio="xMidYMid slice"/></pattern>}
        {trouserTexture && <pattern id={`${id}-trouserTexture`} width="88" height="88" patternUnits="userSpaceOnUse"><image href={trouserTexture} width="88" height="88" preserveAspectRatio="xMidYMid slice"/></pattern>}
      </defs>

      <rect width="600" height="900" fill={`url(#${id}-studio)`}/>
      <path d="M0 720 Q160 680 300 710 T600 700 V900 H0Z" fill="#ece9e3"/>
      <rect x="447" y="310" width="110" height="410" rx="2" fill="#c9c7c3" opacity=".72"/>
      <ellipse cx="300" cy="829" rx="132" ry="23" fill="#8f8a82" opacity=".16"/>

      <g transform={modelTransform} filter={`url(#${id}-shadow)`}>
        {/* mannequin base stays behind every garment */}
        <ellipse cx="300" cy="170" rx="55" ry="68" fill={`url(#${id}-form)`}/>
        <path d="M275 222 L275 260 Q300 278 325 260 L325 222" fill={`url(#${id}-form)`}/>
        <path d="M218 280 Q185 318 188 387 L201 512 Q203 530 221 528 L235 523 L235 312Z" fill={`url(#${id}-form)`}/>
        <path d="M382 280 Q415 318 412 387 L399 512 Q397 530 379 528 L365 523 L365 312Z" fill={`url(#${id}-form)`}/>
        <path d="M214 444 L214 806 L274 806 L300 526 L326 806 L386 806 L386 444Z" fill={`url(#${id}-form)`}/>

        {/* Shirt torso first: when tucked, the trouser waistband masks its hem naturally. */}
        <g>
          {clothLayer(shirtBody, shirtFill, .46)}
          {!isBack && <>
            {shirtStyle === "mandarin" ? <path d="M273 260 Q300 276 327 260 L325 288 Q300 298 275 288Z" fill={shirtFill} stroke="#fff" strokeOpacity=".18"/> : shirtStyle === "cuban" ? <><path d="M254 264 L300 291 L271 324 L241 281Z" fill={shirtFill}/><path d="M346 264 L300 291 L329 324 L359 281Z" fill={shirtFill}/></> : <><path d="M258 263 L300 291 L274 320 L246 279Z" fill={shirtFill}/><path d="M342 263 L300 291 L326 320 L354 279Z" fill={shirtFill}/></>}
            <path d="M300 291V448" stroke="#2b2926" strokeOpacity=".28"/>{[320,350,380,410,440].map(y=><circle key={y} cx="300" cy={y} r="2.5" fill="#554d43" opacity=".66"/>)}
            {shirtStyle === "buttonDown" && <><circle cx="267" cy="294" r="2.3" fill="#554d43"/><circle cx="333" cy="294" r="2.3" fill="#554d43"/></>}
          </>}
        </g>

        {/* Split trouser construction prevents one flat texture from bridging the crotch. */}
        <g>
          {clothLayer(leftLeg, trouserFill, .44)}
          {clothLayer(rightLeg, trouserFill, .44)}
          {clothLayer(waistband, trouserFill, .36)}
          {!isBack && <>
            <path d="M300 440V526" stroke="#2d2a26" strokeOpacity=".34"/>
            <circle cx="300" cy="442" r="4" fill="#3b342c" opacity=".7"/>
            <path d={`M${tg.topLeft+26} 441 v25 M${tg.topRight-26} 441 v25`} stroke="#282522" strokeOpacity=".22"/>
            <path d={`M${tg.topLeft+46} 470 V760 M${tg.topRight-46} 470 V760`} stroke="#111" strokeOpacity=".09"/>
            <path d="M300 462 Q286 483 300 520 Q314 483 300 462" fill="none" stroke="#171513" strokeOpacity=".15"/>
          </>}
        </g>

        {/* Sleeves stay above the trouser side edges, but end cleanly before the hands. */}
        <g>
          {clothLayer(leftSleeve, shirtFill, .44)}
          {clothLayer(rightSleeve, shirtFill, .44)}
          <path d="M199 488 Q216 496 234 488 L235 509 Q218 520 200 510Z" fill={shirtFill} stroke="#211f1c" strokeOpacity=".15"/>
          <path d="M401 488 Q384 496 366 488 L365 509 Q382 520 400 510Z" fill={shirtFill} stroke="#211f1c" strokeOpacity=".15"/>
        </g>

        {/* Hands must remain uncovered by fabric. */}
        <path d="M184 520 q20 -12 40 0 l-7 36 q-16 20 -34 2z" fill={`url(#${id}-form)`}/>
        <path d="M416 520 q-20 -12 -40 0 l7 36 q16 20 34 2z" fill={`url(#${id}-form)`}/>

        {layerStyle !== "none" && <g>
          <path d="M216 276 Q250 252 300 294 Q350 252 384 276 L405 490 Q372 528 330 540 L300 463 L270 540 Q228 528 195 490Z" fill={layerColor}/>
          <path d="M216 276 Q250 252 300 294 Q350 252 384 276 L405 490 Q372 528 330 540 L300 463 L270 540 Q228 528 195 490Z" fill={`url(#${id}-clothLight)`} opacity=".5"/>
          {!isBack && <><path d="M245 278 L300 294 L270 385 L232 321Z" fill="#fff" fillOpacity=".09"/><path d="M355 278 L300 294 L330 385 L368 321Z" fill="#000" fillOpacity=".08"/>
            {layerStyle === "suit" ? <><circle cx="284" cy="420" r="4" fill="#111" opacity=".65"/><circle cx="284" cy="447" r="4" fill="#111" opacity=".65"/></> : <circle cx="300" cy="431" r="4" fill="#111" opacity=".65"/>}
          </>}
        </g>}

        <path d="M220 803 h58 v30 h-79 q-10 -14 21 -30Z" fill="#fbfbf8" stroke="#cbc9c4"/>
        <path d="M322 803 h58 q31 16 21 30 h-79Z" fill="#fbfbf8" stroke="#cbc9c4"/>
      </g>
    </svg>
  );
}
