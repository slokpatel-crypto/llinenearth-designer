import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { catalogGarments } from "@/lib/catalog";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export default function CatalogPage() {
  return (
    <AppShell>
      <section className="businessHero wrap">
        <p className="eyebrow">LLINEN EARTH · GARMENT CATALOG</p>
        <h1>Start with what you want made.</h1>
        <p>Browse the garment category, see the fabrics LLinen Earth works with, then move into the Designer Engine, preview the garment, or enquire directly on WhatsApp.</p>
      </section>

      <section className="catalogSection wrap">
        <div className="catalogGrid">
          {catalogGarments.map((garment, index) => (
            <article className="catalogCard" key={garment.slug}>
              <div className="catalogCardTop"><span>{String(index + 1).padStart(2, "0")}</span><em>MADE TO MEASURE</em></div>
              <h2>{garment.name}</h2>
              <p>{garment.description}</p>
              <div className="catalogFabrics"><span>AVAILABLE FABRICS</span>{garment.fabrics.map((fabric) => <i key={fabric}>{fabric}</i>)}</div>
              <div className="catalogActions">
                <Link className="catalogPrimary" href={`/designer-brief?garment=${garment.slug}`}>Design for me <span>→</span></Link>
                <Link href={`/visual?garment=${garment.slug}`}>Live Visual</Link>
                <a href={buildWhatsAppUrl({ topic: "Garment enquiry", garment: garment.name })} target="_blank" rel="noreferrer">WhatsApp enquiry</a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
