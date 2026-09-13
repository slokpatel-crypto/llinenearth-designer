import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MeasurementStudio } from "@/components/MeasurementStudio";
import "./measurements.css";

export default function MeasurementsPage(){
  return <AppShell>
    <section className="modulePageHero wrap measurementPageHero">
      <p className="eyebrow">LLINEN EARTH · FIT INTELLIGENCE</p>
      <h1>Build the measurement profile.</h1>
      <p>Capture shirt and trouser body measurements with a guided visual map, then let the Designer Engine use them as proportion and fit guidance.</p>
      <Link className="modulePageBack" href="/designer-brief">← Back to Designer Engine</Link>
    </section>
    <div className="wrap"><MeasurementStudio /></div>
  </AppShell>;
}
