import { AppShell } from "@/components/AppShell";
import { ReferenceLookMatcher } from "@/components/ReferenceLookMatcher";

export const metadata = {
  title: "Reference Look Match | Linen Earth",
  description: "Explore Linen Earth catalogue fabric colours from a selected reference-photo colour.",
};

export default function ReferenceMatchPage() {
  return (
    <AppShell>
      <section className="wrap" style={{ padding: "70px 0 38px" }}>
        <p className="eyebrow">LINEN EARTH / STYLE REFERENCE</p>
        <h1 style={{ font: "400 clamp(3rem,5.6vw,5rem)/1 Georgia,serif", margin: "0 0 18px" }}>A look you love. A cloth to explore.</h1>
        <p style={{ maxWidth: 700, color: "#acbfd3", lineHeight: 1.7 }}>
          Start with a photo. Select a colour from the clothing in the image and compare it with our
          fabric catalogue. These are visual candidates, not confirmed fabric or tailoring matches.
        </p>
      </section>
      <div className="wrap"><ReferenceLookMatcher /></div>
    </AppShell>
  );
}
