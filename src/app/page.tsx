import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { HomeMotion } from "@/components/HomeMotion";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const GOOGLE_BUSINESS_URL = "https://www.google.com/maps/search/?api=1&query=LLinen%20Earth%20Murlidhar%20Compound%2049%2F4%20Kalyan%20Rd%20behind%20Shiv%20Mandir%20near%20Masoom%20Hospital%20Bhiwandi%20Maharashtra";
const INSTAGRAM_URL = "https://www.instagram.com/llinenearth.india/";
const SHOP_ADDRESS = "Murlidhar Compound, 49/4, Kalyan Rd, behind Shiv Mandir, near Masoom Hospital, Bhiwandi, Maharashtra";

const garments = [
  { name: "Shirts", image: "/editorial/shirt.webp", className: "editorialShirt", href: "/visual?garment=shirt", note: "Linen · Giza cotton · 100% cotton" },
  { name: "Trousers", image: "/editorial/trouser.webp", className: "editorialTrouser", href: "/visual?garment=trouser", note: "Tailored balance · clean drape" },
  { name: "Suits", image: "/editorial/suit.webp", className: "editorialSuit", href: "/visual?garment=suit", note: "Two-piece · occasion tailoring" },
  { name: "Blazers", image: "/editorial/blazer.webp", className: "editorialBlazer", href: "/visual?garment=blazer", note: "Structured layering · sharp finish" },
] as const;

export default function Home() {
  const whatsappHref = buildWhatsAppUrl({ topic: "Premium fabric and tailoring enquiry from the website" });

  return <AppShell>
    <HomeMotion />
    <main className="gatewayHome sharpHome">
      <section className="gatewayBrand wrap sharpHero" data-reveal>
        <p>PREMIUM FABRICS · BESPOKE MENSWEAR</p>
        <h1><span>LLinen</span> Earth</h1>
        <div className="gatewayLine"><span>FABRIC FIRST · DESIGN WITH INTENT</span><i /></div>
      </section>

      <section className="editorialGarments wrap" data-reveal>
        <div className="editorialGarmentHead">
          <p className="eyebrow">EXPLORE THE WARDROBE</p>
          <h2>Choose the garment.<br/><em>We shape the rest.</em></h2>
        </div>
        <div className="editorialGarmentGrid">
          {garments.map((garment, index) => (
            <Link href={garment.href} className={`editorialGarmentCard ${garment.className}`} key={garment.name}>
              <img src={garment.image} alt={`${garment.name} by LLinen Earth`} />
              <div className="editorialGarmentShade" />
              <div className="editorialGarmentMeta"><span>{String(index + 1).padStart(2, "0")}</span><small>{garment.note}</small></div>
              <div className="editorialGarmentAction"><h3>{garment.name}</h3><strong>Explore <b>↗</b></strong></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="sharpPaths wrap" data-reveal>
        <Link href="/designer-brief" className="sharpPath sharpPathPrimary">
          <span>01 · DESIGN FOR ME</span>
          <h2>Tell us the occasion.<br/>We build the outfit.</h2>
          <strong>Start Designer <b>↗</b></strong>
        </Link>
        <Link href="/visual" className="sharpPath">
          <span>02 · LIVE VISUAL</span>
          <h2>Already know the piece?<br/>See it on the mannequin.</h2>
          <strong>Open Visual <b>↗</b></strong>
        </Link>
      </section>

      <section className="homeContactBand" data-reveal>
        <div className="homeContactInner wrap">
          <div className="homeContactIntro">
            <p className="eyebrow">VISIT · MESSAGE · FOLLOW</p>
            <h2>Continue with LLinen Earth.</h2>
            <p>Visit the Bhiwandi atelier, message us on WhatsApp, or follow new fabrics and tailoring work on Instagram.</p>
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
          </div>
        </div>
      </section>
    </main>
  </AppShell>;
}
