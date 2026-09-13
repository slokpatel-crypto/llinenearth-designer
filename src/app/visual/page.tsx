import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { HomeVisualExplorer } from "@/components/HomeVisualExplorer";
import { OutfitStudio } from "@/components/OutfitStudio";

const lookbook = [
  { title: "Fabric scale", label: "01 / CLOTH", image: "https://images.pexels.com/photos/6766236/pexels-photo-6766236.jpeg?auto=compress&cs=tinysrgb&w=1200" },
  { title: "Tailored structure", label: "02 / FORM", image: "https://images.pexels.com/photos/6765639/pexels-photo-6765639.jpeg?auto=compress&cs=tinysrgb&w=1200" },
  { title: "Fit and finish", label: "03 / FIT", image: "https://images.pexels.com/photos/6766382/pexels-photo-6766382.jpeg?auto=compress&cs=tinysrgb&w=1200" },
];

export default function VisualPage(){
  return <AppShell>
    <section className="modulePageHero wrap">
      <p className="eyebrow">LIVE OUTFIT VISUAL · FULL LOOK</p>
      <h1>See shirt and trouser together.</h1>
      <p>Choose from LLinen Earth shirting and suiting colours, change the shirt and trouser silhouette, and preview the finished combination on one consistent faceless atelier mannequin. Add a matching jacket when the customer wants to see the full suit.</p>
      <Link className="modulePageBack" href="/">← Back to the atelier entrance</Link>
    </section>

    <div className="wrap"><OutfitStudio /></div>

    <section className="modulePageHero wrap visualAdvancedIntro">
      <p className="eyebrow">ADVANCED FABRIC MAPPER</p>
      <h2>Need a closer single-garment study?</h2>
      <p>The original garment studio remains available below for collar, lapel, pleat and uploaded-fabric repeat inspection.</p>
    </section>
    <div className="wrap"><HomeVisualExplorer /></div>

    <section className="visualLookbook wrap" aria-label="Tailoring visual references">
      {lookbook.map((item,index)=><article key={item.title} className={index===0?"visualLook large":"visualLook"} style={{backgroundImage:`url('${item.image}')`}}><div><span>{item.label}</span><strong>{item.title}</strong></div></article>)}
    </section>
  </AppShell>;
}
