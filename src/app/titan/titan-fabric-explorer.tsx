"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  findTitanFabrics, titanFabricCollections, titanFabricHref,
  type TitanFabricKind,
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
  const collections = useMemo(() => titanFabricCollections(kind), [kind]);
  const matching = useMemo(() => findTitanFabrics(kind, collection, search), [kind, collection, search]);
  const visible = expanded ? matching : matching.slice(0, 8);

  function chooseKind(next: TitanFabricKind) {
    setKind(next);
    setCollection("All");
    setExpanded(false);
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
          {visible.map(fabric => (
            <Link key={fabric.id} className="titanFabricCard" href={titanFabricHref(kind, fabric.id)}
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
          ))}
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
      <p className="titanFabricDisclaimer">
        These are genuine catalogue reference images, not scale-calibrated product photographs.
        Selecting a cloth opens the existing Designer Studio; the actual availability,
        repeat size and physical fit remain subject to verification.
      </p>
    </div>
  );
}
