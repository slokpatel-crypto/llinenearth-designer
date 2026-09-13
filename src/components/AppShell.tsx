import Link from "next/link";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { BRAND_LOGO_SRC } from "@/lib/brand-logo-data";

const primaryLinks = [
  ["Catalog", "/catalog"],
  ["Design for me", "/designer-brief"],
  ["Measurements", "/measurements"],
  ["Contact", "/contact"],
] as const;

const secondaryLinks = [
  ["Live Visual", "/visual"],
  ["Saved Designs", "/designs"],
  ["Fashion Brain", "/knowledge"],
  ["Atelier", "/atelier"],
] as const;

function WhatsAppIcon() {
  return <svg className="whatsappIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.7a8.45 8.45 0 0 1-12.53 7.4L3.5 20.5l1.46-4.32A8.45 8.45 0 1 1 20.5 11.7Z"/><path d="M8.35 7.25c.18-.4.38-.4.57-.41h.48c.16 0 .41.06.63.53.22.47.76 1.84.83 1.97.07.13.11.28.02.45-.09.18-.13.28-.26.43-.13.15-.28.33-.4.44-.13.13-.27.27-.12.53.15.27.67 1.1 1.44 1.78.99.88 1.82 1.15 2.08 1.28.27.13.42.11.57-.07.16-.17.66-.77.83-1.03.18-.26.35-.22.59-.13.24.09 1.51.71 1.77.84.26.13.44.2.5.31.07.11.07.64-.15 1.26-.22.62-1.27 1.19-1.75 1.26-.45.06-1.03.09-1.66-.11-.38-.12-.86-.28-1.48-.54a12.44 12.44 0 0 1-4.76-4.2c-.36-.51-.97-1.36-.97-2.59 0-1.23.64-1.83.87-2.08Z"/></svg>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const whatsappHref = buildWhatsAppUrl({ topic: "Premium fabric and tailoring" });
  return <div className="siteShell atelierShell">
    <header className="atelierBrandBand">
      <Link href="/" className="atelierBrand" aria-label="LLinen Earth home">
        <img src={BRAND_LOGO_SRC} alt="LLinen Earth" width="1273" height="531" />
      </Link>
    </header>

    <div className="atelierBody">
      <aside className="atelierRail" aria-label="Site navigation">
        <nav className="atelierRailPrimary">
          {primaryLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div className="atelierRailDivider" />
        <nav className="atelierRailSecondary">
          {secondaryLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <a className="atelierRailWhatsapp" href={whatsappHref} target="_blank" rel="noreferrer"><span><WhatsAppIcon/></span><div><small>ENQUIRE</small><strong>WhatsApp us</strong></div></a>
      </aside>

      <div className="atelierContent">
        <main>{children}</main>
        <footer className="atelierFooter wrap">
          <div><strong>LLinen Earth</strong><span>Premium fabric. Considered tailoring.</span></div>
          <nav aria-label="Footer navigation">
            {primaryLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
            {secondaryLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
          </nav>
        </footer>
      </div>
    </div>

    <a className="floatingWhatsapp" href={whatsappHref} target="_blank" rel="noreferrer" aria-label="Enquire with LLinen Earth on WhatsApp"><span><WhatsAppIcon/></span><strong>WhatsApp</strong></a>

    <nav className="atelierMobileDock" aria-label="Mobile primary navigation">
      {primaryLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
    </nav>
  </div>;
}
