"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { AtelierMannequin, type LayerStyle, type MannequinView, type ShirtStyle, type TrouserStyle } from "@/components/AtelierMannequin";

const suitingFabrics = [
  { name: "Midnight Navy", color: "#14243b" },
  { name: "Black", color: "#17191d" },
  { name: "Beige", color: "#b8aa97" },
  { name: "Olive", color: "#59624a" },
  { name: "White", color: "#eceae3" },
] as const;

const shirtingFabrics = [
  { name: "Optic White", color: "#f8f7f2" }, { name: "Ivory", color: "#eee8da" },
  { name: "Sky Blue", color: "#b9d2e6" }, { name: "Powder Blue", color: "#cadbea" },
  { name: "Navy", color: "#213b5d" }, { name: "Black", color: "#202124" },
  { name: "Sage", color: "#a8b29e" }, { name: "Olive", color: "#6d745b" },
  { name: "Sand", color: "#d4c2a2" }, { name: "Beige", color: "#c9b79e" },
  { name: "Soft Pink", color: "#e7c8c9" }, { name: "Lavender", color: "#cfc9df" },
  { name: "Steel Grey", color: "#aab2bb" }, { name: "Wine", color: "#6f3541" },
] as const;

const shirtStyles: { id: ShirtStyle; name: string; detail: string }[] = [
  { id: "classic", name: "Classic Spread", detail: "balanced everyday tailoring" },
  { id: "slim", name: "Slim Cutaway", detail: "cleaner body and sharper collar" },
  { id: "buttonDown", name: "Button-down", detail: "soft collar roll, smart casual" },
  { id: "cuban", name: "Cuban / Camp", detail: "open collar, relaxed luxury" },
  { id: "mandarin", name: "Mandarin", detail: "minimal band-collar line" },
];

const trouserStyles: { id: TrouserStyle; name: string; detail: string }[] = [
  { id: "straight", name: "Straight Fit", detail: "clean line from thigh to hem" },
  { id: "tapered", name: "Slim / Tapered", detail: "narrower ankle and modern fit" },
  { id: "relaxed", name: "Relaxed Fit", detail: "more room through seat and leg" },
  { id: "wide", name: "Wide Leg", detail: "fashion-led full silhouette" },
  { id: "bell", name: "Bell Bottom", detail: "fitted knee with flared hem" },
];

function readFabric(event: ChangeEvent<HTMLInputElement>, onRead: (value: string | null) => void) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = () => onRead(typeof reader.result === "string" ? reader.result : null);
  reader.readAsDataURL(file);
}

export function OutfitStudio() {
  const [shirtIndex, setShirtIndex] = useState(0);
  const [suitingIndex, setSuitingIndex] = useState(0);
  const [shirtStyle, setShirtStyle] = useState<ShirtStyle>("classic");
  const [trouserStyle, setTrouserStyle] = useState<TrouserStyle>("straight");
  const [layerStyle, setLayerStyle] = useState<LayerStyle>("none");
  const [view, setView] = useState<MannequinView>("front");
  const [shirtTexture, setShirtTexture] = useState<string | null>(null);
  const [trouserTexture, setTrouserTexture] = useState<string | null>(null);

  const shirt = shirtingFabrics[shirtIndex];
  const suiting = suitingFabrics[suitingIndex];
  const summary = useMemo(() => `${shirt.name} ${shirtStyles.find(x=>x.id===shirtStyle)?.name} + ${suiting.name} ${trouserStyles.find(x=>x.id===trouserStyle)?.name}${layerStyle === "none" ? "" : layerStyle === "suit" ? " + matching suit jacket" : " + blazer"}`, [shirt, suiting, shirtStyle, trouserStyle, layerStyle]);

  return <section className="outfitStudio" aria-label="LLinen Earth full outfit fabric preview">
    <div className="outfitStudioIntro">
      <div><p className="eyebrow">FULL OUTFIT STUDIO · SAME MANNEQUIN</p><h2>Choose the cloth. See the finished combination.</h2></div>
      <p>This view is designed around one consistent faceless menswear mannequin. Pick a plain shirting fabric, a suiting fabric, and the silhouette. Shirt and trouser update together so the customer sees the outfit rather than isolated swatches.</p>
    </div>

    <div className="outfitStudioGrid">
      <div className="outfitMannequinStage">
        <div className="outfitViewTabs">
          {(["front","threeQuarter","back"] as MannequinView[]).map(item => <button key={item} className={view===item?"active":""} onClick={()=>setView(item)}>{item === "threeQuarter" ? "3/4 view" : item}</button>)}
        </div>
        <AtelierMannequin shirtColor={shirt.color} trouserColor={suiting.color} layerColor={suiting.color} shirtTexture={shirtTexture} trouserTexture={trouserTexture} shirtStyle={shirtStyle} trouserStyle={trouserStyle} layerStyle={layerStyle} view={view}/>
        <div className="outfitReadout"><span>LIVE COMBINATION</span><strong>{summary}</strong></div>
      </div>

      <div className="outfitControls">
        <section className="outfitControlBlock">
          <div className="outfitControlHead"><span>01</span><div><strong>Shirting fabric</strong><small>14 plain starting colours</small></div></div>
          <div className="fabricChipGrid">{shirtingFabrics.map((item,index)=><button key={item.name} className={shirtIndex===index && !shirtTexture?"active":""} onClick={()=>{setShirtIndex(index);setShirtTexture(null)}}><i style={{background:item.color}}/><span>{item.name}</span></button>)}</div>
          <label className="fabricUploadButton">Use real shirt fabric photo<input type="file" accept="image/*" onChange={(e)=>readFabric(e,setShirtTexture)}/></label>
        </section>

        <section className="outfitControlBlock">
          <div className="outfitControlHead"><span>02</span><div><strong>Suiting fabric</strong><small>Navy · black · beige · olive · white</small></div></div>
          <div className="fabricChipGrid suiting">{suitingFabrics.map((item,index)=><button key={item.name} className={suitingIndex===index && !trouserTexture?"active":""} onClick={()=>{setSuitingIndex(index);setTrouserTexture(null)}}><i style={{background:item.color}}/><span>{item.name}</span></button>)}</div>
          <label className="fabricUploadButton">Use real trouser / suiting fabric photo<input type="file" accept="image/*" onChange={(e)=>readFabric(e,setTrouserTexture)}/></label>
        </section>

        <section className="outfitControlBlock split">
          <div><div className="outfitControlHead"><span>03</span><div><strong>Shirt style</strong><small>5 major directions</small></div></div><div className="styleChoiceList">{shirtStyles.map(item=><button key={item.id} className={shirtStyle===item.id?"active":""} onClick={()=>setShirtStyle(item.id)}><strong>{item.name}</strong><small>{item.detail}</small></button>)}</div></div>
          <div><div className="outfitControlHead"><span>04</span><div><strong>Trouser style</strong><small>5 common silhouettes</small></div></div><div className="styleChoiceList">{trouserStyles.map(item=><button key={item.id} className={trouserStyle===item.id?"active":""} onClick={()=>setTrouserStyle(item.id)}><strong>{item.name}</strong><small>{item.detail}</small></button>)}</div></div>
        </section>

        <section className="outfitControlBlock">
          <div className="outfitControlHead"><span>05</span><div><strong>Complete the outfit</strong><small>Use the same suiting cloth as a layer</small></div></div>
          <div className="layerChoices"><button className={layerStyle==="none"?"active":""} onClick={()=>setLayerStyle("none")}>Shirt + trouser</button><button className={layerStyle==="suit"?"active":""} onClick={()=>setLayerStyle("suit")}>Matching suit</button><button className={layerStyle==="blazer"?"active":""} onClick={()=>setLayerStyle("blazer")}>Blazer combination</button></div>
        </section>
      </div>
    </div>
  </section>;
}
