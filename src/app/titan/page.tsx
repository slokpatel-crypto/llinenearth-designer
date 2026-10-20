import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import TitanHeaderNavigation from "./titan-header-navigation";
import TitanFabricExplorer from "./titan-fabric-explorer";
import TitanLayerPlanner from "./titan-layer-planner";
import { TITAN_OCCASIONS, titanOccasionHref } from "@/lib/titan/occasion-handoff";
import { BRAND_LOGO_SRC, BRAND_LOGO_SIZE } from "@/lib/brand-logo-data";
import { titanDevelopmentTrack, titanJourneys, titanQuickLinks } from "@/lib/titan/navigation";
import "./titan.css";

export const metadata: Metadata = {
  title: "The Linen Earth Studio | TITAN",
  description: "Explore Linen Earth fabric design, coordinated styling and measurement journeys in one considered studio.",
  robots: { index: false, follow: false },
};

export default function TitanStudioPage() {
  return (
    <div className="titan">
      <a className="titanSkip" href="#titan-main">Skip to main content</a>
      <div className="titanAnnouncement">
        <span>LINEN EARTH / TITAN EXPERIENCE PREVIEW</span>
        <span>Existing designer engine · New presentation layer</span>
      </div>

      <header className="titanHeader">
        <Link href="/" className="titanIdentity" aria-label="Linen Earth homepage">
          <Image src={BRAND_LOGO_SRC} alt="Linen Earth" {...BRAND_LOGO_SIZE} unoptimized />
        </Link>
        <TitanHeaderNavigation />
        <Link href="/designer-studio" className="titanHeaderCta">
          Enter the designer <span aria-hidden="true">↗</span>
        </Link>
      </header>

      <main id="titan-main" tabIndex={-1}>
        <section className="titanHero" aria-labelledby="titan-heading">
          <div className="titanHeroCopy">
            <p className="titanKicker"><span className="titanKickerMark" /> THE ART OF DRESSING WELL</p>
            <h1 id="titan-heading">Considered cloth.<br/><em>Entirely yours.</em></h1>
            <p className="titanHeroDescription">
              A more personal way to explore fine fabrics, shape an outfit and prepare the fit.
              Your next great look begins with the cloth.
            </p>
            <div className="titanHeroActions">
              <Link href="/designer-studio" className="titanButton titanButtonPrimary">
                Design your outfit <span aria-hidden="true">↗</span>
              </Link>
              <Link href="/style-director" className="titanButton titanButtonSecondary">
                Explore style direction <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className="titanHeroMeta" aria-label="Studio principles">
              <span>FABRIC FIRST</span><i aria-hidden="true" /><span>PERSONAL FIT</span><i aria-hidden="true" /><span>TIMELESS STYLE</span>
            </div>
          </div>
          <div className="titanHeroVisual">
            <Image
              src="/designer/studio-tucked.webp"
              alt="Linen Earth reference model wearing coordinated menswear"
              fill priority sizes="(max-width: 860px) 100vw, 48vw"
              className="titanHeroPhoto"
            />
            <div className="titanHeroPhotoFade" aria-hidden="true" />
            <div className="titanHeroPhotoLabel">
              <span>THE LINEN EARTH EDIT</span>
              <strong>Fabric. Shape. Identity.</strong>
            </div>
            <div className="titanHeroIndex" aria-hidden="true">01 / 03</div>
          </div>
        </section>

        <section className="titanOccasionSection" aria-labelledby="titan-occasion-title">
          <div className="titanOccasionHeading">
            <p className="titanOverline">A SHORTER PATH TO YOUR STYLE</p>
            <h2 id="titan-occasion-title">What are you dressing for?</h2>
            <p>Choose your occasion to continue in the existing Style Director. The first answer carries across; no paid AI render is needed to start.</p>
          </div>
          <div className="titanOccasionOptions" aria-label="Start Style Director by occasion">
            {TITAN_OCCASIONS.map((occasion) => (
              <Link key={occasion} href={titanOccasionHref(occasion)} className="titanOccasionLink">
                {occasion}<span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </section>

        <section id="titan-fabrics" className="titanSection titanFabricSection" aria-labelledby="titan-fabrics-title">
          <div className="titanSectionIntro">
            <div>
              <p className="titanOverline">FABRIC IS THE BEGINNING</p>
              <h2 id="titan-fabrics-title">Discover your cloth.<br/><em>Build from the real catalogue.</em></h2>
            </div>
            <p>Browse Linen Earth's existing shirting and trouser swatches. Select a reference to carry that fabric into the working Designer Studio.</p>
          </div>
          <TitanFabricExplorer />
        </section>

        <TitanLayerPlanner />

        <section id="titan-journeys" className="titanSection titanJourneys" aria-labelledby="titan-journeys-title">
          <div className="titanSectionIntro">
            <div>
              <p className="titanOverline">YOUR STUDIO, YOUR WAY</p>
              <h2 id="titan-journeys-title">One destination.<br/><em>Every detail considered.</em></h2>
            </div>
            <p>Step into an existing Linen Earth workflow. Each experience connects to a real application route, not a simulated configurator.</p>
          </div>

          <div className="titanJourneyGrid">
            {titanJourneys.map((journey) => (
              <Link className="titanJourneyCard" key={journey.id} href={journey.href}>
                <div className="titanJourneyImage">
                  <Image src={journey.image} alt={journey.imageAlt} fill sizes="(max-width: 700px) 90vw, (max-width: 1020px) 45vw, 30vw" />
                  <span className="titanJourneyNumber">{journey.number}</span>
                </div>
                <div className="titanJourneyContent">
                  <span className="titanOverline">{journey.eyebrow}</span>
                  <h3>{journey.title}</h3>
                  <p>{journey.description}</p>
                  <strong>{journey.action} <span aria-hidden="true">↗</span></strong>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section id="titan-process" className="titanExperience" aria-labelledby="titan-process-title">
          <div className="titanExperienceContent">
            <p className="titanOverline">THE LINEN EARTH METHOD</p>
            <h2 id="titan-process-title">Designed around<br/><em>your point of view.</em></h2>
            <p>Start with the fabric, choose your silhouette, and refine the proportions. The studio keeps styling decisions connected to real tailoring conversations.</p>
            <ol className="titanProcessList">
              <li><span>01</span><div><strong>Choose your cloth</strong><p>Explore available shirting and trouser options.</p></div></li>
              <li><span>02</span><div><strong>Compose your outfit</strong><p>Refine garment and styling choices in the existing designer.</p></div></li>
              <li><span>03</span><div><strong>Prepare your fit</strong><p>Use measurement guidance before your tailoring consultation.</p></div></li>
            </ol>
            <Link href="/measurements" className="titanTextLink">Explore the measurement studio <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="titanExperienceVisual">
            <Image src="/editorial/blazer.webp" alt="Linen Earth tailored garment reference" fill sizes="(max-width: 860px) 100vw, 45vw" />
            <div className="titanExperienceStamp">A WARDROBE WITH INTENTION <span>EST. LINEN EARTH</span></div>
          </div>
        </section>

        <section className="titanSection titanEngineering" aria-labelledby="titan-build-title">
          <div className="titanSectionIntro">
            <div>
              <p className="titanOverline">NEXT IN THE ATELIER</p>
              <h2 id="titan-build-title">The craft continues.</h2>
            </div>
            <p>This design-preview route does not imply that the underlying 3D, fabric calibration or commerce work has passed production validation.</p>
          </div>
          <div className="titanTrackGrid">
            {titanDevelopmentTrack.map((item) => (
              <article className="titanTrack" key={item.id}>
                <span className="titanTrackNumber">{item.number}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <span className="titanTrackState">IN DEVELOPMENT</span>
              </article>
            ))}
          </div>
        </section>

        <section className="titanClosing">
          <p className="titanOverline">YOUR NEXT LOOK STARTS HERE</p>
          <h2>Let's make it <em>personal.</em></h2>
          <p>Explore your fabric and design options, then continue with Linen Earth's team for final fit and material decisions.</p>
          <Link href="/designer-studio" className="titanButton titanButtonLight">Enter Designer Studio <span aria-hidden="true">↗</span></Link>
        </section>
      </main>

      <footer className="titanFooter">
        <div className="titanFooterBrand"><strong>Linen Earth</strong><span>Premium fabrics · Thoughtful tailoring</span></div>
        <nav aria-label="TITAN footer navigation">
          {titanQuickLinks.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}
        </nav>
        <p>TITAN is an unreleased interface preview. Existing journeys remain on their current routes.</p>
      </footer>
    </div>
  );
}
