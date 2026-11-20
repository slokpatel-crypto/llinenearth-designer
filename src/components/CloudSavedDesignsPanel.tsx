"use client";

import { useState } from "react";
import { deleteCloudDesign, getCloudDesign, listCloudDesigns, saveCloudDesign } from "@/lib/customer-saved-design-client";
import type { SavedDesign } from "@/lib/saved-designs";

/** Cloud records are deliberately separate from browser drafts: no implicit migration. */
export function CloudSavedDesignsPanel({ localDesigns }: { localDesigns: SavedDesign[] }) {
  const [cloud, setCloud] = useState<SavedDesign[]>([]);
  const [selected, setSelected] = useState<SavedDesign | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadId, setUploadId] = useState("");
  const [message, setMessage] = useState("");
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try { await action(); }
    catch (error) { setCloud([]); setSelected(null); setMessage(error instanceof Error ? error.message : "Cloud unavailable."); }
    finally { setBusy(false); }
  }
  return <section aria-label="Signed-in cloud designs" className="savedIntro">
    <div>
      <h2>Signed-in cloud designs</h2>
      <p>Cloud saves require a signed-in account. Browser drafts stay on this device until you explicitly choose to upload one.</p>
      <button disabled={busy} onClick={() => void run(async () => {
        setCloud(await listCloudDesigns()); setSelected(null);
      })}>Load my cloud designs</button>
      {localDesigns.length > 0 && <div>
        <label htmlFor="cloud-local-select">Choose a browser draft to upload</label>
        <select id="cloud-local-select" value={uploadId} onChange={(event) => setUploadId(event.currentTarget.value)} disabled={busy}>
          <option value="">Choose a draft</option>
          {localDesigns.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
        <button type="button" disabled={busy || !uploadId} onClick={() => void run(async () => {
          const draft = localDesigns.find((item) => item.id === uploadId);
          if (!draft) throw new Error("Draft no longer available.");
          await saveCloudDesign(draft);
          setCloud(await listCloudDesigns());
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
        <button disabled={busy} onClick={() => void run(async () => {
          const recovered = await getCloudDesign(item.id);
          if (!recovered) throw new Error("Cloud design no longer exists.");
          setSelected(recovered);
        })}>{item.title} — Recover details</button>
        <button type="button" disabled={busy} onClick={() => {
          if (!window.confirm(`Delete cloud design "${item.title}"? This does not delete your browser drafts.`)) return;
          void run(async () => {
            const deleted = await deleteCloudDesign(item.id);
            if (!deleted) throw new Error("Cloud design could not be deleted.");
            setCloud(await listCloudDesigns());
            setSelected(null);
            setMessage("Cloud design deleted. Browser drafts unchanged.");
          });
        }}>Delete cloud copy</button>
      </li>)}</ul>
      {selected && <div role="status">
        <strong>{selected.title}</strong>
        <p>Recovered cloud design {selected.id}. Version {selected.version.id}.</p>
        <p>Cloud recovery does not overwrite browser drafts or claim production lock approval.</p>
      </div>}
    </div>}
  </section>;
}
