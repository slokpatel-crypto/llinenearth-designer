"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  TITAN_FABRIC_CATALOG, findTitanFabrics, titanFabricCollections, titanFabricHref,
  toggleTitanComparedFabrics, titanOutfitPairHref, type TitanFabricKind,
  type TitanFabricReference,
} from "@/lib/titan/fabric-handoff";

/** Hide a failed reference photo rather than showing a broken-image icon or
 * substituting a fabricated/uncalibrated textile. Fabric ID remains selectable.
 * key={fabric.id} resets the failure state if the actual reference changes. */
function TitanReferencePhoto({ fabric, alt, sizes }: {
  fabric: TitanFabricReference; alt: string; sizes: string;
}) {
  const [unavailable, setUnavailable] = useState(false);
  if (unavailable) {
    return (
      <span className="titanFabricPhotoFallback" role="img"
        aria-label={`Reference photograph unavailable for ${fabric.name}`}>
        Reference photo unavailable
      </span>
    );
  }
  return <Image src={fabric.image} alt={alt} fill sizes={sizes} onError={() => setUnavailable(true)} />;
}

/**
 * An actual searchable preview of the existing catalogue, not generated
 * fabric imagery or a promise of physical stock. Choice is carried into the
 * maintained Designer Studio, which applies its own calibrated catalogue.
 */
export default function TitanFabricExplorer() {
  const [kind, setKind] = useState<TitanFabricKind>("shirt");
  const [collection, setCollection] = useState("All");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [comparedIds, setComparedIds] = useState<string[]>([]);
  const [outfitShirtId, setOutfitShirtId] = useState<string | null>(null);
  const [outfitTrouserId, setOutfitTrouserId] = useState<string | null>(null);
  const outfitShirt = TITAN_FABRIC_CATALOG.find(fabric => fabric.kind === "shirt" && fabric.id === outfitShirtId);
  const outfitTrouser = TITAN_FABRIC_CATALOG.find(fabric => fabric.kind === "trouser" && fabric.id === outfitTrouserId);
  const comparisons = useMemo(
    () => comparedIds.map(id => TITAN_FABRIC_CATALOG.find(fabric => fabric.kind === kind && fabric.id === id)).filter(
      (fabric): fabric is (typeof TITAN_FABRIC_CATALOG)[number] => Boolean(fabric)
    ), [comparedIds, kind]
  );
  const collections = useMemo(() => titanFabricCollections(kind), [kind]);
  const matching = useMemo(() => findTitanFabrics(kind, collection, search), [kind, collection, search]);
  const visible = expanded ? matching : matching.slice(0, 8);

  function chooseKind(next: TitanFabricKind) {
    setKind(next);
    setCollection("All");
    setExpanded(false);
    setComparedIds([]);
  }

  return (
    <div className="titanFabricExplorer">
      <div className="titanFabricToolbar">
        <fieldset className="titanFabricKinds">
          <legend>Garment fabric</legend>
          <div>
            <button type="button" aria-pressed={kind === "shirt"} onClick={() => chooseKind("shirt")}>Shirting</button>
            <button type="button" aria-pressed={kind === "trouser"} onClick={() => chooseKind("trouser")}>Trouser cloth</button>
          </div>
        </fieldset>
        <label className="titanFabricField">
          Collection
          <select value={collection} onChange={event => { setCollection(event.target.value); setExpanded(false); }}>
            <option value="All">All collections</option>
            {collections.map(line => <option key={line} value={line}>{line}</option>)}
          </select>
        </label>
        <label className="titanFabricField titanFabricSearch">
          Find by colour or pattern
          <input value={search} onChange={event => { setSearch(event.target.value); setExpanded(false); }}
            type="search" maxLength={100} placeholder="e.g. blue, stripe, linen" />
        </label>
      </div>
      <div className="titanFabricResultsHeader">
        <p role="status" aria-live="polite">{matching.length} catalogue {matching.length === 1 ? "reference" : "references"}</p>
        <span>Stock, actual colour and physical repeat need confirmation.</span>
      </div>
      {visible.length > 0 ? (
        <div className="titanFabricGrid">
          {visible.map(fabric => {
            const selected = comparedIds.includes(fabric.id);
            return (
              <div className="titanFabricTile" key={fabric.id}>
                <Link className="titanFabricCard" href={titanFabricHref(kind, fabric.id)}
                  aria-label={`Select ${fabric.name} ${kind} fabric in Designer Studio`}>
                  <div className="titanFabricImage" style={{ backgroundColor: fabric.hex }}>
                    <TitanReferencePhoto key={fabric.id} fabric={fabric}
                      alt={`${fabric.name} · ${fabric.pattern} catalogue swatch`}
                      sizes="(max-width: 560px) 44vw, (max-width: 860px) 30vw, 20vw" />
                  </div>
                  <div className="titanFabricInfo">
                    <span>{fabric.line}</span>
                    <strong>{fabric.name}</strong>
                    <p>{fabric.pattern}</p>
                    <span className="titanFabricCardAction">Use in designer <span aria-hidden="true">↗</span></span>
                  </div>
                </Link>
                <button type="button" className="titanFabricCompareButton"
                  aria-pressed={selected} aria-label={`${selected ? "Remove" : "Compare"} ${fabric.name} ${kind} reference`}
                  disabled={comparedIds.length === 2 && !selected}
                  onClick={() => setComparedIds(previous => toggleTitanComparedFabrics(kind, previous, fabric.id))}>
                  {selected ? "✓ In comparison" : "Compare swatch"}
                </button>
                <button type="button" className="titanFabricOutfitSelect"
                  aria-pressed={kind === "shirt" ? outfitShirtId === fabric.id : outfitTrouserId === fabric.id}
                  aria-label={`${kind === "shirt" ? "Choose as shirt" : "Choose as trouser"}: ${fabric.name}`}
                  onClick={() => {
                    if (kind === "shirt") setOutfitShirtId(previous => previous === fabric.id ? null : fabric.id);
                    else setOutfitTrouserId(previous => previous === fabric.id ? null : fabric.id);
                  }}>
                  {(kind === "shirt" ? outfitShirtId : outfitTrouserId) === fabric.id
                    ? "✓ In your outfit" : `Choose as ${kind === "shirt" ? "shirt" : "trouser"}`}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="titanFabricEmpty" role="status">No catalogue matches. Try another collection or search term.</p>
      )}
      {!expanded && matching.length > 8 && (
        <button type="button" className="titanFabricShowMore" onClick={() => setExpanded(true)}>
          Show all {matching.length} references <span aria-hidden="true">↓</span>
        </button>
      )}
      {expanded && matching.length > 8 && (
        <button type="button" className="titanFabricShowMore" onClick={() => setExpanded(false)}>
          Show fewer references <span aria-hidden="true">↑</span>
        </button>
      )}
      {comparisons.length > 0 && (
        <section id="titan-fabric-comparison" className="titanFabricComparison" aria-labelledby="titan-fabric-compare-title">
          <div className="titanFabricComparisonHeading">
            <div>
              <p className="titanOverline">CATALOGUE SHORTLIST</p>
              <h3 id="titan-fabric-compare-title">Compare your swatches</h3>
            </div>
            <button type="button" className="titanFabricComparisonClear" onClick={() => setComparedIds([])}>
              Clear comparison
            </button>
          </div>
          <p className="titanFabricCompareStatus" role="status" aria-live="polite">
            {comparisons.length} of 2 references selected. {comparisons.length === 2
              ? "Remove a swatch to consider another."
              : "Choose one more from the same garment category."}
          </p>
          <div className="titanFabricComparisonGrid">
            {comparisons.map(fabric => (
              <article key={fabric.id} className="titanFabricComparisonItem">
                <div className="titanFabricComparisonImage" style={{ backgroundColor: fabric.hex }}>
                  <TitanReferencePhoto key={fabric.id} fabric={fabric}
                    alt={`${fabric.name} catalogue swatch for comparison`}
                    sizes="(max-width: 620px) 44vw, 30vw" />
                </div>
                <div className="titanFabricComparisonDetails">
                  <h4>{fabric.name}</h4>
                  <p>{fabric.line} · {fabric.pattern}</p>
                  <Link href={titanFabricHref(kind, fabric.id)} aria-label={`Use compared ${fabric.name} in Designer Studio`}>
                    Use in Designer Studio <span aria-hidden="true">↗</span>
                  </Link>
                </div>
              </article>
            ))}
            {comparisons.length === 1 && (
              <div className="titanFabricComparisonPlaceholder" aria-hidden="true">
                <span>02</span><p>Choose a second swatch to view alongside this one.</p>
              </div>
            )}
          </div>
          <p className="titanFabricComparisonWarning">
            Visual comparison only. Catalogue photographs have no verified shared lighting,
            real-world colour calibration, pattern-repeat scale or cloth-drape certification.
          </p>
        </section>
      )}
      <section className="titanOutfitBuilder" aria-labelledby="titan-outfit-title">
        <div className="titanOutfitBuilderHeading">
          <div>
            <p className="titanOverline">YOUR CLOTH PAIR</p>
            <h3 id="titan-outfit-title">Build a two-piece outfit</h3>
          </div>
          <p role="status" aria-live="polite">
            {(outfitShirt ? 1 : 0) + (outfitTrouser ? 1 : 0)} of 2 garments chosen
          </p>
        </div>
        <div className="titanOutfitSlots">
          {(["shirt", "trouser"] as const).map(slot => {
            const fabric = slot === "shirt" ? outfitShirt : outfitTrouser;
            return (
              <article key={slot} className="titanOutfitSlot">
                <div className="titanOutfitSlotMedia">
                  {fabric ? <TitanReferencePhoto key={fabric.id} fabric={fabric}
                    alt={`${fabric.name} ${slot} catalogue photo`}
                    sizes="(max-width: 620px) 30vw, 140px" /> : <span aria-hidden="true">{slot === "shirt" ? "01" : "02"}</span>}
                </div>
                <div className="titanOutfitSlotText">
                  <strong>{slot === "shirt" ? "Shirting" : "Trouser cloth"}</strong>
                  {fabric ? (
                    <>
                      <p>{fabric.name}</p>
                      <span>{fabric.line}</span>
                      <button type="button" onClick={() => {
                        if (slot === "shirt") setOutfitShirtId(null);
                        else setOutfitTrouserId(null);
                      }} aria-label={`Remove ${fabric.name} ${slot} from outfit`}>Remove cloth</button>
                    </>
                  ) : (
                    <>
                      <p>No cloth selected</p>
                      <button type="button" onClick={() => chooseKind(slot)}>
                        Browse {slot === "shirt" ? "shirting" : "trousers"}
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        {outfitShirt && outfitTrouser ? (
          <Link className="titanOutfitBuildCta" href={titanOutfitPairHref(outfitShirt.id, outfitTrouser.id)}>
            Open both fabrics in Designer Studio <span aria-hidden="true">↗</span>
          </Link>
        ) : (
          <p className="titanOutfitHelp">Select one shirt fabric and one trouser fabric to continue with both in the existing designer.</p>
        )}
        <p className="titanOutfitCaution">
          This pairs two real catalogue references, not a calibrated photo of a finished outfit.
          Stock, exact colour, repeat scale and physical fit still need verification. No design is
          saved or changed by browsing; opening Designer Studio applies the two explicit choices.
        </p>
      </section>
      <p className="titanFabricDisclaimer">
        These are genuine catalogue reference images, not scale-calibrated product photographs.
        Selecting a cloth opens the existing Designer Studio; the actual availability,
        repeat size and physical fit remain subject to verification.
      </p>
    </div>
  );
}
