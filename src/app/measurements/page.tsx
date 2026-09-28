import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { CustomerMeasurements } from "@/components/CustomerMeasurements";

export default function MeasurementsPage(){
  return <AppShell>
    <section className="modulePageHero wrap measurementPageHero">
      <p className="eyebrow">LINEN EARTH · FIT INTELLIGENCE</p>
      <h1>Build a customer measurement profile.</h1>
      <p>Save named shirt and trouser measurements in centimetres or inches on this device, then hand the active profile directly into the existing Designer Engine.</p>
      <Link className="modulePageBack" href="/designer-studio">← Back to Designer</Link>
    </section>
    <div className="wrap"><CustomerMeasurements /></div>
  </AppShell>;
}
