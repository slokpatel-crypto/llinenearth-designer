import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { HomeVisualExplorer } from "@/components/HomeVisualExplorer";

const lookbook = [
  { title: "Fabric scale", label: "01 / CLOTH", image: "https://images.pexels.com/photos/6766236/pexels-photo-6766236.jpeg?auto=compress&cs=tinysrgb&w=1200" },
  { title: "Tailored structure", label: "02 / FORM", image: "https://images.pexels.com/photos/6765639/pexels-photo-6765639.jpeg?auto=compress&cs=tinysrgb&w=1200" },
  { title: "Fit and finish", label: "03 / FIT", image: "https://images.pexels.com/photos/6766382/pexels-photo-6766382.jpeg?auto=compress&cs=tinysrgb&w=1200" },
];

export default function VisualPage(){
  return <AppShell>
    <section className="modulePageHero wrap">
      <p className="eyebrow">LIVE GARMENT VISUAL · FABRIC MAPPING</p>
      <h1>See the cloth on the garment.</h1>
      <p>Choose a shirt, trouser, suit or blazer, switch styling details, then upload a real fabric photo. The preview maps that cloth image onto the garment while keeping studio light, seams, folds and garment construction visible.</p>
      <Link className="modulePageBack" href="/">← Back to the atelier entrance</Link>
    </section>

    <div className="wrap"><HomeVisualExplorer /></div>

    <section className="visualLookbook wrap" aria-label="Tailoring visual references">
      {lookbook.map((item,index)=><article key={item.title} className={index===0?"visualLook large":"visualLook"} style={{backgroundImage:`url('${item.image}')`}}><div><span>{item.label}</span><strong>{item.title}</strong></div></article>)}
    </section>
  </AppShell>;
}
