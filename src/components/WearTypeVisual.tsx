import type { WearType } from "@/lib/fashion-intelligence";

function Shirt({ wear }: { wear: WearType }) {
  const band = wear.visual.collar?.toLowerCase().includes("band");
  const camp = wear.visual.collar?.toLowerCase().includes("camp");
  return <svg viewBox="0 0 300 380" role="img" aria-label={wear.name}>
    <path d="M83 90 126 66h48l43 24 32 61-31 18-13-25v156H95V144l-13 25-31-18 32-61Z" fill="currentColor" opacity=".92"/>
    {!band && <path d={camp ? "M126 67 150 104 174 67 188 86 150 124 112 86Z" : "M126 67 150 100 174 67 184 82 150 115 116 82Z"} fill="#08111e" opacity=".9"/>}
    {band && <path d="M130 67h40v20h-40z" fill="#08111e" opacity=".9"/>}
    <path d="M150 112v180" stroke="#08111e" strokeWidth="5" opacity=".75"/>
    {[145,178,211,244].map((y)=><circle key={y} cx="160" cy={y} r="3.5" fill="#d6bd91"/>)}
  </svg>;
}

function Trouser({ wear }: { wear: WearType }) {
  const pleats = wear.visual.pleats || 0;
  const high = wear.visual.rise?.includes("high");
  const wide = wear.name.toLowerCase().includes("wide");
  return <svg viewBox="0 0 300 380" role="img" aria-label={wear.name}>
    <path d={`M90 ${high?55:72}h120l${wide?25:8} 285h-73l-15-205-15 205H67L90 ${high?55:72}Z`} fill="currentColor" opacity=".93"/>
    <path d={`M90 ${high?55:72}h120`} stroke="#d6bd91" strokeWidth="8"/>
    {Array.from({length:pleats}).map((_,i)=><path key={i} d={`M${128+i*18} ${high?70:87}v90`} stroke="#08111e" strokeWidth="4" opacity=".55"/>)}
    {wear.visual.closure?.includes("wrap") && <path d="M92 58h118l-38 34H90Z" fill="#08111e" opacity=".35"/>}
    {wear.visual.closure?.includes("drawstring") && <path d="M125 76q25 24 50 0" fill="none" stroke="#08111e" strokeWidth="5"/>}
  </svg>;
}

function Jacket({ wear }: { wear: WearType }) {
  const dbl = wear.name.toLowerCase().includes("double");
  const peak = wear.visual.lapel?.toLowerCase().includes("peak");
  return <svg viewBox="0 0 300 380" role="img" aria-label={wear.name}>
    <path d="M82 88 126 60h48l44 28 30 62-30 20-13-27v161H95V143l-13 27-30-20 30-62Z" fill="currentColor" opacity=".94"/>
    <path d={peak ? "M126 61 150 150 103 100 132 82 150 61 168 82 197 100 150 150 174 61" : "M126 61 150 144 112 96 132 82 150 61 168 82 188 96 150 144 174 61"} fill="#08111e" opacity=".82"/>
    {dbl ? <><path d="M140 145v145M172 145v145" stroke="#08111e" strokeWidth="4"/><g fill="#d6bd91">{[170,205,240].flatMap(y=>[145,175].map(x=><circle key={`${x}-${y}`} cx={x} cy={y} r="4"/>))}</g></> : <><path d="M150 145v145" stroke="#08111e" strokeWidth="4"/><g fill="#d6bd91">{[185,225].map(y=><circle key={y} cx="160" cy={y} r="4"/>)}</g></>}
  </svg>;
}

function Indian({ wear }: { wear: WearType }) {
  const long = wear.visual.length?.includes("knee") || wear.name.includes("Achkan") || wear.name.includes("Sherwani");
  const sleeveless = wear.name.includes("Nehru");
  return <svg viewBox="0 0 300 380" role="img" aria-label={wear.name}>
    <path d={`M88 84 128 58h44l40 26 ${sleeveless?"0 0":"26 60-28 18-12-23"}v${long?230:170}H108V${long?315:255}${sleeveless?"":"l-12 23-28-18 26-60"}Z`} fill="currentColor" opacity=".94"/>
    <rect x="132" y="52" width="36" height="28" rx="7" fill="#08111e" opacity=".9"/>
    <path d={`M150 82v${long?218:165}`} stroke="#08111e" strokeWidth="5"/>
    {[112,145,178,211].map((y)=><circle key={y} cx="160" cy={y} r="3.5" fill="#d6bd91"/>)}
  </svg>;
}

export function WearTypeVisual({ wear }: { wear: WearType }) {
  return <div className={`wearVisual family-${wear.family}`}>
    {wear.family === "shirt" && <Shirt wear={wear}/>} 
    {wear.family === "trouser" && <Trouser wear={wear}/>} 
    {(wear.family === "jacket" || wear.family === "suit") && <Jacket wear={wear}/>} 
    {wear.family === "indian" && <Indian wear={wear}/>} 
  </div>;
}
