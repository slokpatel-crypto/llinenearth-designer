import { AppShell } from "@/components/AppShell";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export default function ContactPage() {
  const whatsappHref = buildWhatsAppUrl({ topic: "Shop visit and tailoring consultation" });
  return (
    <AppShell>
      <section className="businessHero contactHero wrap">
        <p className="eyebrow">VISIT LLINEN EARTH · BHIWANDI</p>
        <h1>See the cloth. Feel the hand. Get the fit right.</h1>
        <p>LLinen Earth is built around individual customers who want considered fabric and tailoring, not bulk ordering. Visit the shop in Bhiwandi to compare cloth in person, discuss the occasion and refine the final fit with the tailoring team.</p>
      </section>

      <section className="contactGrid wrap">
        <article className="contactVisitCard">
          <span className="micro">SHOP LOCATION</span>
          <h2>LLinen Earth</h2>
          <p className="contactAddress">Bhiwandi, Maharashtra, India</p>
          <p>Visit for fabric selection, personal styling direction, measurements and tailoring consultation.</p>
          <div className="contactVisitSteps"><div><b>01</b><span>Bring your occasion, reference or fabric requirement.</span></div><div><b>02</b><span>Compare fabric texture, drape and colour in person.</span></div><div><b>03</b><span>Finalize measurements, styling and tailoring direction.</span></div></div>
        </article>

        <article className="contactEnquiryCard">
          <span className="micro">FASTEST ENQUIRY</span>
          <h2>Start on WhatsApp.</h2>
          <p>Tell us what you need made and when you plan to wear it. We can prepare the conversation before you visit the shop.</p>
          <a className="contactWhatsapp" href={whatsappHref} target="_blank" rel="noreferrer">Open WhatsApp <span>→</span></a>
        </article>
      </section>
    </AppShell>
  );
}
