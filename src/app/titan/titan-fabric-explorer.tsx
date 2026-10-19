"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { readTitanSharedOutfit, titanOutfitShareHref } from "@/lib/titan/outfit-share";
import { suggestTitanPairings } from "@/lib/titan/pairing-ideas";
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
const FABRIC_PAGE_SIZE = 8;

export default function TitanFabricExplorer() {
  const [kind, setKind] = useState<TitanFabricKind>("shirt");
  const [collection, setCollection] = useState("All");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(FABRIC_PAGE_SIZE);
  const [comparedIds, setComparedIds] = useState<string[]>([]);
  const [outfitShirtId, setOutfitShirtId] = useState<string | null>(null);
  const [outfitTrouserId, setOutfitTrouserId] = useState<string | null>(null);
  const [shareOrigin, setShareOrigin] = useState("");
  const [shareCopyResult, setShareCopyResult] = useState<string | null>(null);
  const shareInputRef = useRef<HTMLInputElement>(null);

  // A shared link restores *reference choices* only, never a design, user
  // account, measurement, stock claim or saved Designer draft. Invalid links
  // leave both slots empty and do not trigger a Designer handoff.
  useEffect(() => {
    setShareOrigin(window.location.origin);
    const shared = readTitanSharedOutfit(window.location.search);
    if (!shared) return;
    setOutfitShirtId(shared.shirtId);
    setOutfitTrouserId(shared.trouserId);
  }, []);
  const outfitShirt = TITAN_FABRIC_CATALOG.find(fabric => fabric.kind === "shirt" && fabric.id === outfitShirtId);
  const outfitTrouser = TITAN_FABRIC_CATALOG.find(fabric => fabric.kind === "trouser" && fabric.id === outfitTrouserId);
  const shareHref = outfitShirt && outfitTrouser ? titanOutfitShareHref(outfitShirt.id, outfitTrouser.id) : null;
  // Propose the complementary garment only when exactly one garment has
  // been chosen. Never override an already-complete manual customer pair.
  const pairingIdeas = useMemo(
    () => outfitShirt && !outfitTrouser ? suggestTitanPairings("shirt", outfitShirt.id)
      : outfitTrouser && !outfitShirt ? suggestTitanPairings("trouser", outfitTrouser.id) : [],
    [outfitShirt?.id, outfitTrouser?.id],
  );

  async function copyOutfitReferenceLink() {
    if (!shareHref) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(new URL(shareHref, window.location.origin).href);
      setShareCopyResult(shareHref);
    } catch {
      // Clipboard permission can be denied on mobile or insecure contexts.
      // Expose a selected real URL for keyboard/touch copying, not a dead button.
      shareInputRef.current?.focus();
      shareInputRef.current?.select();
      setShareCopyResult(`manual:${shareHref}`);
    }
  }
  const comparisons = useMemo(
    () => comparedIds.map(id => TITAN_FABRIC_CATALOG.find(fabric => fabric.kind === kind && fabric.id === id)).filter(
      (fabric): fabric is (typeof TITAN_FABRIC_CATALOG)[number] => Boolean(fabric)
    ), [comparedIds, kind]
  );
  const collections = useMemo(() => titanFabricCollections(kind), [kind]);
  const matching = useMemo(() => findTitanFabrics(kind, collection, search), [kind, collection, search]);
  const visible = matching.slice(0, visibleCount);

  function chooseKind(next: TitanFabricKind) {
    setKind(next);
    setCollection("All");
    // A search for blue shirting should not hide every trouser swatch after
    // switching garment tabs or pressing "Browse trousers" from the builder.
    setSearch("");
    setVisibleCount(FABRIC_PAGE_SIZE);
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
          <select value={collection} onChange={event => { setCollection(event.target.value); setVisibleCount(FABRIC_PAGE_SIZE); }}>
            <option value="All">All collections</option>
            {collections.map(line => <option key={line} value={line}>{line}</option>)}
          </select>
        </label>
        <label className="titanFabricField titanFabricSearch">
          Find by colour or pattern
          <input value={search} onChange={event => { setSearch(event.target.value); setVisibleCount(FABRIC_PAGE_SIZE); }}
            type="search" maxLength={100} placeholder="e.g. blue, stripe, linen" />
        </label>
      </div>
      <div className="titanFabricResultsHeader">
        <p role="status" aria-live="polite">Showing {visible.length} of {matching.length} catalogue {matching.length === 1 ? "reference" : "references"}</p>
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
      {matching.length > FABRIC_PAGE_SIZE && (
        <div className="titanFabricPagination">
          {visible.length < matching.length && (
            <button type="button" className="titanFabricShowMore"
              onClick={() => setVisibleCount(previous => Math.min(previous + FABRIC_PAGE_SIZE, matching.length))}>
              Load next {Math.min(FABRIC_PAGE_SIZE, matching.length - visible.length)} references <span aria-hidden="true">↓</span>
            </button>
          )}
          {visibleCount > FABRIC_PAGE_SIZE && (
            <button type="button" className="titanFabricShowMore" onClick={() => setVisibleCount(FABRIC_PAGE_SIZE)}>
              Show fewer references <span aria-hidden="true">↑</span>
            </button>
          )}
        </div>
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
      <section id="titan-outfit-builder" className="titanOutfitBuilder" aria-labelledby="titan-outfit-title">
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
        {pairingIdeas.length > 0 && (
          <section className="titanPairingIdeas" aria-labelledby="titan-pairing-ideas-title">
            <div className="titanPairingHeading">
              <p className="titanOverline">CURATED FROM OUR REAL CATALOGUE</p>
              <h4 id="titan-pairing-ideas-title">Discover a complementary cloth</h4>
              <p>Three optional editorial directions for your unfilled garment.
                Your selected cloth stays unchanged until you choose a pair.</p>
            </div>
            <div className="titanPairingGrid">
              {pairingIdeas.map(idea => (
                <article className="titanPairingCard" key={idea.id}>
                  <div className="titanPairingPhoto" style={{ backgroundColor: idea.counterpart.hex }}>
                    <TitanReferencePhoto key={idea.counterpart.id} fabric={idea.counterpart}
                      alt={`${idea.counterpart.name} catalogue reference`} sizes="(max-width: 700px) 30vw, 180px" />
                  </div>
                  <div className="titanPairingCardCopy">
                    <strong>{idea.title}</strong>
                    <h5>{idea.counterpart.name}</h5>
                    <span>{idea.counterpart.line} · {idea.counterpart.pattern}</span>
                    <p>{idea.reason}</p>
                    <button type="button"
                      aria-label={`Use ${idea.counterpart.name} with the chosen ${outfitShirt ? "shirt" : "trouser"} reference`}
                      onClick={() => {
                        setOutfitShirtId(idea.shirtId);
                        setOutfitTrouserId(idea.trouserId);
                      }}>Use this cloth pair</button>
                  </div>
                </article>
              ))}
            </div>
            <p className="titanPairingCaution">Editorial catalogue ideas only.
              The Style Director remains the dedicated styling workflow. Exact colour,
              fabric compatibility, stock and fit have not been physically validated.</p>
          </section>
        )}
        {outfitShirt && outfitTrouser ? (
          <>
            <div className="titanOutfitActions">
              <Link className="titanOutfitBuildCta" href={titanOutfitPairHref(outfitShirt.id, outfitTrouser.id)}>
                Open both fabrics in Designer Studio <span aria-hidden="true">↗</span>
              </Link>
              {/* A shared URL points back to this same route. A document navigation
                  revalidates its query and restores the reference pair instead
                  of retaining stale transient state from a Next client Link. */}
              <a className="titanOutfitShareCta" href={shareHref!}>
                Open shareable cloth-pair link <span aria-hidden="true">↗</span>
              </a>
            </div>
            <div className="titanOutfitShareTools">
              <label className="titanOutfitShareField">
                Share these two cloth references
                <input ref={shareInputRef} className="titanOutfitShareInput" type="text" readOnly
                  value={`${shareOrigin}${shareHref}`}
                  onFocus={event => event.currentTarget.select()}
                  aria-label="Shareable outfit reference link" />
              </label>
              <button type="button" className="titanOutfitCopyButton"
                onClick={() => void copyOutfitReferenceLink()}>
                Copy link
              </button>
            </div>
            {shareCopyResult === shareHref ? (
              <p className="titanOutfitCopyStatus" role="status">Cloth-pair link copied.</p>
            ) : shareCopyResult === `manual:${shareHref}` ? (
              <p className="titanOutfitCopyStatus" role="status">Copy the link from the field above.</p>
            ) : null}
            <p className="titanOutfitShareHelp">
              The link always reflects your current two choices. It reopens catalogue references,
              not account details, measurements or a saved design.
            </p>
          </>
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
