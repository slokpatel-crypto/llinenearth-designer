import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { HomeMotion } from "@/components/HomeMotion";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const designerRefs = [
  "https://images.pexels.com/photos/6766382/pexels-photo-6766382.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/6765068/pexels-photo-6765068.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/6765003/pexels-photo-6765003.jpeg?auto=compress&cs=tinysrgb&w=600",
];
const visualRefs = [
  "https://images.pexels.com/photos/6766236/pexels-photo-6766236.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/6765639/pexels-photo-6765639.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/6766385/pexels-photo-6766385.jpeg?auto=compress&cs=tinysrgb&w=600",
];

const GOOGLE_BUSINESS_URL = "https://www.google.com/maps/search/?api=1&query=LLinen%20Earth%20Murlidhar%20Compound%2049%2F4%20Kalyan%20Rd%20behind%20Shiv%20Mandir%20near%20Masoom%20Hospital%20Bhiwandi%20Maharashtra";
const INSTAGRAM_URL = "https://www.instagram.com/llinenearth.india/";
const SHOP_ADDRESS = "Murlidhar Compound, 49/4, Kalyan Rd, behind Shiv Mandir, near Masoom Hospital, Bhiwandi, Maharashtra";

export default function Home() {
  const whatsappHref = buildWhatsAppUrl({ topic: "Premium fabric and tailoring enquiry from the website" });

  return <AppShell>
    <HomeMotion />
    <main className="gatewayHome">
      <section className="gatewayBrand wrap" data-reveal>
        <p>PREMIUM FABRICS · INTELLIGENT MENSWEAR · DIGITAL ATELIER</p>
        <h1><span>LLinen</span> Earth</h1>
        <div className="gatewayLine"><span>FABRIC FIRST · DESIGN WITH INTENT</span><i /></div>
      </section>

      <section className="gatewayIntro wrap" data-reveal>
        <div><p className="eyebrow">CHOOSE HOW YOU WANT TO DESIGN</p><h2>Two ways into the atelier.</h2></div>
        <p>Use the Designer when you want LLinen Earth to decide what works for your occasion. Use Live Visual when you already know what you want and want to see garment, style and fabric clearly on the mannequin.</p>
      </section>

      <section className="gatewayChoices wrap" data-reveal>
        <Link href="/designer-brief" className="gatewayCard gatewayDesigner">
          <div className="gatewayImage gatewayImageDesigner" />
          <div className="gatewayCardTop"><span>01</span><b>AI DESIGNER ENGINE</b></div>
          <div className="gatewayVisualStrip" aria-hidden="true">{designerRefs.map((src,index)=><div key={src} className="gatewayMini" style={{backgroundImage:`url('${src}')`}} data-index={index}/>)}</div>
          <div className="gatewayCardCopy">
            <p className="eyebrow">GUIDED DESIGN</p><h3>Find the right outfit for the moment.</h3>
            <p>Occasion, venue, time, climate, formality, impression, fit and aesthetic are narrowed before the cloth is judged.</p>
            <div className="gatewaySignals"><span>OCCASION</span><span>FABRIC</span><span>FIT</span><span>OUTFIT</span></div>
            <strong>Start Designer <i>↗</i></strong>
          </div>
        </Link>

        <Link href="/visual" className="gatewayCard gatewayVisual">
          <div className="gatewayImage gatewayImageVisual" />
          <div className="gatewayCardTop"><span>02</span><b>LIVE GARMENT VISUAL</b></div>
          <div className="gatewayVisualStrip" aria-hidden="true">{visualRefs.map((src,index)=><div key={src} className="gatewayMini" style={{backgroundImage:`url('${src}')`}} data-index={index}/>)}</div>
          <div className="gatewayCardCopy">
            <p className="eyebrow">VISUAL CLARITY</p><h3>See the garment before you decide.</h3>
            <p>Choose shirt, trouser, suit or blazer, change styling details, and map a real fabric photograph onto the garment surface.</p>
            <div className="gatewaySignals"><span>SHIRT</span><span>TROUSER</span><span>SUIT</span><span>BLAZER</span></div>
            <strong>Open Live Visual <i>↗</i></strong>
          </div>
        </Link>
      </section>

      <section className="gatewayFoot wrap" data-reveal><span>LLINEN EARTH / DIGITAL ATELIER</span><p>Designer for judgement. Live Visual for clarity. Atelier for execution.</p></section>

      <section className="homeContactBand" data-reveal>
        <div className="homeContactInner wrap">
          <div className="homeContactIntro">
            <p className="eyebrow">VISIT · MESSAGE · FOLLOW</p>
            <h2>Continue the conversation beyond the screen.</h2>
            <p>Visit LLinen Earth in Bhiwandi to see fabrics in person, message the team directly on WhatsApp, or follow the latest fabric and tailoring updates on Instagram.</p>
          </div>
          <div>
            <div className="homeContactDetails">
              <div className="homeContactRow"><span>WhatsApp</span><a href={whatsappHref} target="_blank" rel="noreferrer">+91 92263 38282</a></div>
              <div className="homeContactRow"><span>Address</span><address>{SHOP_ADDRESS}</address></div>
              <div className="homeContactRow"><span>Instagram</span><a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">@llinenearth.india</a></div>
            </div>
            <div className="homeContactLinks">
              <a className="homeContactPrimary" href={whatsappHref} target="_blank" rel="noreferrer"><span>WhatsApp enquiry</span><b>↗</b></a>
              <a href={GOOGLE_BUSINESS_URL} target="_blank" rel="noreferrer"><span>Google Business</span><b>↗</b></a>
              <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer"><span>Instagram</span><b>↗</b></a>
            </div>
            <p className="homeContactNote">Google Business opens the LLinen Earth location search in Google Maps.</p>
          </div>
        </div>
      </section>
    </main>
  </AppShell>;
}
