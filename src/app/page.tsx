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

const garments = [
  { name: "Shirts", image: "/editorial/shirt.webp", className: "editorialShirt", href: "/visual?garment=shirt", note: "Linen · Giza cotton · 100% cotton" },
  { name: "Trousers", image: "/editorial/trouser.webp", className: "editorialTrouser", href: "/visual?garment=trouser", note: "Tailored balance · clean drape" },
  { name: "Suits", image: "/editorial/suit.webp", className: "editorialSuit", href: "/visual?garment=suit", note: "Two-piece · occasion tailoring" },
  { name: "Blazers", image: "/editorial/blazer.webp", className: "editorialBlazer", href: "/visual?garment=blazer", note: "Structured layering · sharp finish" },
] as const;

const GOOGLE_BUSINESS_URL = "https://www.google.com/maps/search/?api=1&query=LLinen%20Earth%20Murlidhar%20Compound%2049%2F4%20Kalyan%20Rd%20behind%20Shiv%20Mandir%20near%20Masoom%20Hospital%20Bhiwandi%20Maharashtra";
const INSTAGRAM_URL = "https://www.instagram.com/llinenearth.india/";
const SHOP_ADDRESS = "Murlidhar Compound, 49/4, Kalyan Rd, behind Shiv Mandir, near Masoom Hospital, Bhiwandi, Maharashtra";

function WhatsAppIcon() {
  return <svg className="contactIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.7a8.45 8.45 0 0 1-12.53 7.4L3.5 20.5l1.46-4.32A8.45 8.45 0 1 1 20.5 11.7Z"/><path d="M8.35 7.25c.18-.4.38-.4.57-.41h.48c.16 0 .41.06.63.53.22.47.76 1.84.83 1.97.07.13.11.28.02.45-.09.18-.13.28-.26.43-.13.15-.28.33-.4.44-.13.13-.27.27-.12.53.15.27.67 1.1 1.44 1.78.99.88 1.82 1.15 2.08 1.28.27.13.42.11.57-.07.16-.17.66-.77.83-1.03.18-.26.35-.22.59-.13.24.09 1.51.71 1.77.84.26.13.44.2.5.31.07.11.07.64-.15 1.26-.22.62-1.27 1.19-1.75 1.26-.45.06-1.03.09-1.66-.11-.38-.12-.86-.28-1.48-.54a12.44 12.44 0 0 1-4.76-4.2c-.36-.51-.97-1.36-.97-2.59 0-1.23.64-1.83.87-2.08Z"/></svg>;
}

function InstagramIcon() {
  return <svg className="contactIcon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle className="contactIconFill" cx="17.3" cy="6.8" r="1.1"/></svg>;
}

function PinIcon() {
  return <svg className="contactIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.45 6-11a6 6 0 1 0-12 0c0 5.55 6 11 6 11Z"/><circle cx="12" cy="10" r="2.2"/></svg>;
}

export default function Home() {
  const whatsappHref = buildWhatsAppUrl({ topic: "Premium fabric and tailoring enquiry from the website" });

  return <AppShell>
    <HomeMotion />
    <main className="gatewayHome">
      <section className="gatewayBrand gatewayBrandHero wrap" data-reveal>
        <div className="gatewayBrandCopy">
          <p>PREMIUM FABRICS · INTELLIGENT MENSWEAR · DIGITAL ATELIER</p>
          <h1><span>LLinen</span> Earth</h1>
          <p className="gatewayHeroStatement">Cloth, judged on a real body.</p>
          <p className="gatewayHeroSub">Start with your occasion and instinct. LLinen Earth narrows the direction, connects it to real fabric, and lets you see the look with photoreal fashion rendering.</p>
          <div className="gatewayHeroActions">
            <Link href="/style-director">Enter Style Director <b>↗</b></Link>
            <Link href="/visual">Open Live Visual <b>↗</b></Link>
          </div>
          <div className="gatewayLine"><span>FABRIC FIRST · DESIGN WITH INTENT</span><i /></div>
        </div>
        <div className="gatewayHeroModel" aria-label="Photoreal LLinen Earth menswear model">
          <div className="gatewayHeroGlow" />
          <img src="/api/homepage-model" alt="Photoreal menswear model styled for LLinen Earth" fetchPriority="high" />
          <div className="gatewayHeroBadge"><span>AI ATELIER MODEL</span><b>FASHN · PHOTOREAL</b></div>
          <div className="gatewayHeroCaption"><span>REALISTIC SILHOUETTE</span><i/> <span>FABRIC-LED STYLING</span></div>
        </div>
      </section>

      <section className="gatewayIntro wrap" data-reveal>
        <div><p className="eyebrow">CHOOSE HOW YOU WANT TO DESIGN</p><h2>Two ways into the atelier.</h2></div>
        <p>Use the Designer when you want LLinen Earth to decide what works for your occasion. Use Live Visual when you already know what you want and want to see garment, style and fabric clearly on the mannequin.</p>
      </section>

      <section className="gatewayChoices wrap" data-reveal>
        <Link href="/style-director" className="gatewayCard gatewayDesigner">
          <div className="gatewayImage gatewayImageDesigner" />
          <div className="gatewayCardTop"><span>01</span><b>STYLE DIRECTOR</b></div>
          <div className="gatewayVisualStrip" aria-hidden="true">{designerRefs.map((src,index)=><div key={src} className="gatewayMini" style={{backgroundImage:`url('${src}')`}} data-index={index}/>)}</div>
          <div className="gatewayCardCopy">
            <p className="eyebrow">GUIDED DESIGN</p><h3>Find the right outfit for the moment.</h3>
            <p>Occasion, venue, time, climate, formality, impression, fit and aesthetic are narrowed before the cloth is judged.</p>
            <div className="gatewaySignals"><span>OCCASION</span><span>FABRIC</span><span>FIT</span><span>OUTFIT</span></div>
            <strong>Enter Style Director <i>↗</i></strong>
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

      <section className="editorialGarments wrap" data-reveal aria-label="Garment categories">
        <div className="editorialGarmentGrid">
          {garments.map((garment) => (
            <Link href={garment.href} className={`editorialGarmentCard ${garment.className}`} key={garment.name}>
              <img src={garment.image} alt={`${garment.name} by LLinen Earth`} />
              <div className="editorialGarmentShade" />
              <div className="editorialGarmentMeta"><small>{garment.note}</small></div>
              <div className="editorialGarmentAction"><h3>{garment.name}</h3><strong>Explore <b>↗</b></strong></div>
            </Link>
          ))}
        </div>
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
              <div className="homeContactRow"><span className="contactLabel"><WhatsAppIcon/>WhatsApp</span><a href={whatsappHref} target="_blank" rel="noreferrer">+91 92263 38282</a></div>
              <div className="homeContactRow"><span className="contactLabel"><PinIcon/>Address</span><address>{SHOP_ADDRESS}</address></div>
              <div className="homeContactRow"><span className="contactLabel"><InstagramIcon/>Instagram</span><a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">@llinenearth.india</a></div>
            </div>
            <div className="homeContactLinks">
              <a className="homeContactPrimary" href={whatsappHref} target="_blank" rel="noreferrer"><span className="contactLinkLabel"><WhatsAppIcon/>WhatsApp enquiry</span><b>↗</b></a>
              <a href={GOOGLE_BUSINESS_URL} target="_blank" rel="noreferrer"><span className="contactLinkLabel"><PinIcon/>Google Business</span><b>↗</b></a>
              <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer"><span className="contactLinkLabel"><InstagramIcon/>Instagram</span><b>↗</b></a>
            </div>
            <p className="homeContactNote">Google Business opens the LLinen Earth location search in Google Maps.</p>
          </div>
        </div>
      </section>
    </main>
  </AppShell>;
}
