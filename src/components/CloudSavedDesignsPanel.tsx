"use client";

import { useEffect, useRef, useState } from "react";
import { currentCloudCustomerId, deleteCloudDesign, getCloudDesign, listCloudDesigns, saveCloudDesign } from "@/lib/customer-saved-design-client";
import { importCloudDesignExport } from "@/lib/cloud-design-import";
import type { SavedDesign } from "@/lib/saved-designs";

/** Cloud records are deliberately separate from browser drafts: no implicit migration. */
export function CloudSavedDesignsPanel({ localDesigns, onImported }: { localDesigns: SavedDesign[]; onImported: (saved: SavedDesign) => void }) {
  const [cloud, setCloud] = useState<SavedDesign[]>([]);
  const [selected, setSelected] = useState<SavedDesign | null>(null);
  const [busy, setBusy] = useState(false);
  // A synchronous guard closes the gap before React commits disabled controls.
  const inFlight = useRef(false);
  const loadedOwner = useRef<string | null>(null);
  const visibilityEpoch = useRef(0);
  // Session cookies are HTTP-only: after returning to this tab, discard
  // previous account data rather than displaying it until another action.
  useEffect(() => {
    function clearPrivateView() {
      visibilityEpoch.current++;
      loadedOwner.current = null;
      setCloud([]);
      setSelected(null);
      setMessage("Cloud records were hidden for privacy. Load your cloud designs to verify this session.");
    }
    function onVisible() { if (document.visibilityState === "visible") clearPrivateView(); }
    window.addEventListener("focus", clearPrivateView);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", clearPrivateView);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  const [uploadId, setUploadId] = useState("");
  const [message, setMessage] = useState("");
  async function run(action: (assertOwner: () => Promise<void>) => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    const startedAt = visibilityEpoch.current;
    try {
      const owner = await currentCloudCustomerId();
      if (startedAt !== visibilityEpoch.current || (loadedOwner.current && loadedOwner.current !== owner))
        throw new Error("Customer session changed. Reload cloud designs before continuing.");
      loadedOwner.current = owner;
      const assertOwner = async () => {
        const current = await currentCloudCustomerId();
        if (startedAt !== visibilityEpoch.current || current !== owner)
          throw new Error("Customer session changed. Private cloud data was hidden.");
      };
      await action(assertOwner);
      await assertOwner();
    } catch (error) {
      loadedOwner.current = null;
      setCloud([]);
      setSelected(null);
      setMessage(error instanceof Error ? error.message : "Cloud unavailable.");
    } finally { inFlight.current = false; setBusy(false); }
  }
  return <section aria-label="Signed-in cloud designs" className="savedIntro">
    <div>
      <h2>Signed-in cloud designs</h2>
      <p>Cloud saves require a signed-in account. Browser drafts stay on this device until you explicitly choose to upload one.</p>
      <button disabled={busy} onClick={() => void run(async (assertOwner) => {
        const designs = await listCloudDesigns();
        await assertOwner();
        setCloud(designs);
        setSelected(null);
      })}>Load my cloud designs</button>
      {localDesigns.length > 0 && <div>
        <label htmlFor="cloud-local-select">Choose a browser draft to upload</label>
        <select id="cloud-local-select" value={uploadId} onChange={(event) => setUploadId(event.currentTarget.value)} disabled={busy}>
          <option value="">Choose a draft</option>
          {localDesigns.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
        <button type="button" disabled={busy || !uploadId} onClick={() => void run(async (assertOwner) => {
          const draft = localDesigns.find((item) => item.id === uploadId);
          if (!draft) throw new Error("Draft no longer available.");
          await assertOwner();
          await saveCloudDesign(draft);
          const designs = await listCloudDesigns();
          await assertOwner();
          setCloud(designs);
          setSelected(null);
          setUploadId("");
          setMessage("Cloud save confirmed.");
        })}>Upload selected draft</button>
      </div>}
      {message && <p role="status">{message}</p>}
    </div>
    {cloud.length > 0 && <div>
      <h3>Cloud records</h3>
      <ul>{cloud.map((item) => <li key={item.id}>
        <button disabled={busy} onClick={() => void run(async (assertOwner) => {
          const recovered = await getCloudDesign(item.id);
          await assertOwner();
          if (!recovered) throw new Error("Cloud design no longer exists.");
          setSelected(recovered);
        })}>{item.title} — Recover details</button>
        <button type="button" disabled={busy} onClick={() => {
          if (!window.confirm(`Delete cloud design "${item.title}"? This does not delete your browser drafts.`)) return;
          void run(async (assertOwner) => {
            await assertOwner();
            const deleted = await deleteCloudDesign(item.id);
            if (!deleted) throw new Error("Cloud design could not be deleted.");
            const designs = await listCloudDesigns();
            await assertOwner();
            setCloud(designs);
            setSelected(null);
            setMessage("Cloud design deleted. Browser drafts unchanged.");
          });
        }}>Delete cloud copy</button>
      </li>)}</ul>
      {selected && <div role="status">
        <strong>{selected.title}</strong>
        <p>Recovered cloud design {selected.id}. Version {selected.version.id}.</p>
        <p>Cloud recovery does not overwrite browser drafts or claim production lock approval.</p>
        <button type="button" disabled={busy} onClick={() => void run(async (assertOwner) => {
          await assertOwner();
          // Explicit export is safer than silently replacing local drafts. The
          // versioned recipe remains inspectable even on a second device.
          const payload = JSON.stringify({
            schemaVersion: 1, designId: selected.id, title: selected.title,
            brief: selected.brief, version: selected.version, renderSet: selected.renderSet,
          }, null, 2);
          const blob = new Blob([payload], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          try {
            const link = document.createElement("a");
            link.href = url;
            link.download = "linen-earth-cloud-design.json";
            link.click();
            setMessage("Versioned cloud design exported. Browser drafts unchanged.");
          } finally {
            URL.revokeObjectURL(url);
          }
        })}>Export recovered recipe JSON</button>
        <button type="button" disabled={busy} onClick={() => {
          if (!window.confirm(`Import cloud design "${selected.title}" into browser drafts on this device? Existing drafts will be preserved. This is not a production lock.`)) return;
          void run(async (assertOwner) => {
            await assertOwner();
            // The selected cloud record was fetched through the authenticated,
            // owner-scoped recovery API. Importing is a separate local-only action.
            const recovered = importCloudDesignExport(window.localStorage, {
              schemaVersion: 1, designId: selected.id, title: selected.title,
              brief: selected.brief, version: selected.version, renderSet: selected.renderSet,
            });
            onImported(recovered);
            setMessage("Cloud design imported as a browser draft on this device. Cloud copy unchanged; production lock not verified.");
          });
        }}>Import into browser drafts</button>
      </div>}
    </div>}
  </section>;
}
