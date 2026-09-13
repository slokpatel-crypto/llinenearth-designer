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
        <a className="atelierRailWhatsapp" href={whatsappHref} target="_blank" rel="noreferrer"><span>WA</span><div><small>ENQUIRE</small><strong>WhatsApp us</strong></div></a>
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

    <a className="floatingWhatsapp" href={whatsappHref} target="_blank" rel="noreferrer" aria-label="Enquire with LLinen Earth on WhatsApp"><span>WA</span><strong>WhatsApp</strong></a>

    <nav className="atelierMobileDock" aria-label="Mobile primary navigation">
      {primaryLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
    </nav>
  </div>;
}
