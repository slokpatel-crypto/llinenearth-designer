"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  TITAN_FABRIC_CATALOG, findTitanFabrics, titanFabricCollections, titanFabricHref,
  toggleTitanComparedFabrics, type TitanFabricKind,
} from "@/lib/titan/fabric-handoff";

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
                    <Image src={fabric.image} alt={`${fabric.name} · ${fabric.pattern} catalogue swatch`}
                      fill sizes="(max-width: 560px) 44vw, (max-width: 860px) 30vw, 20vw" />
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
                  <Image src={fabric.image} alt={`${fabric.name} catalogue swatch for comparison`}
                    fill sizes="(max-width: 620px) 44vw, 30vw" />
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
      <p className="titanFabricDisclaimer">
        These are genuine catalogue reference images, not scale-calibrated product photographs.
        Selecting a cloth opens the existing Designer Studio; the actual availability,
        repeat size and physical fit remain subject to verification.
      </p>
    </div>
  );
}
