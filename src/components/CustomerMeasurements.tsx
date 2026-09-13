"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  activateCustomerMeasurementProfile,
  customerMeasurementFields,
  listCustomerMeasurementProfiles,
  measurementFromCm,
  measurementToCm,
  profileMeasurementSummary,
  removeCustomerMeasurementProfile,
  saveCustomerMeasurementProfile,
  type CustomerMeasurementKey,
  type CustomerMeasurementProfile,
  type CustomerMeasurementUnit,
} from "@/lib/customer-measurements";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export function CustomerMeasurements() {
  const [profiles, setProfiles] = useState<CustomerMeasurementProfile[]>([]);
  const [profileId, setProfileId] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<CustomerMeasurementUnit>("in");
  const [measurements, setMeasurements] = useState<Partial<Record<CustomerMeasurementKey, number>>>({});
  const [status, setStatus] = useState("");

  useEffect(() => setProfiles(listCustomerMeasurementProfiles()), []);

  const missingRequired = useMemo(
    () => customerMeasurementFields.filter((field) => field.required && measurements[field.key] == null),
    [measurements],
  );

  function displayValue(cm: number | undefined) {
    if (cm == null) return "Not set";
    return `${measurementFromCm(cm, unit).toFixed(unit === "in" ? 2 : 1)} ${unit}`;
  }

  function setMeasurement(key: CustomerMeasurementKey, displayValueNumber: number) {
    setMeasurements((current) => ({ ...current, [key]: measurementToCm(displayValueNumber, unit) }));
    setStatus("");
  }

  function clearMeasurement(key: CustomerMeasurementKey) {
    setMeasurements((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function saveProfile() {
    if (!name.trim()) {
      setStatus("Add the customer name before saving.");
      return;
    }
    if (missingRequired.length) {
      setStatus(`Add required measurements: ${missingRequired.map((field) => field.label).join(", ")}.`);
      return;
    }
    const saved = saveCustomerMeasurementProfile({ id: profileId, name, unit, measurements });
    setProfileId(saved.id);
    setProfiles(listCustomerMeasurementProfiles());
    setStatus(`${saved.name} is saved on this device and selected for the Designer Engine.`);
  }

  function loadProfile(profile: CustomerMeasurementProfile) {
    setProfileId(profile.id);
    setName(profile.name);
    setUnit(profile.unit);
    setMeasurements(profile.measurements);
    activateCustomerMeasurementProfile(profile);
    setStatus(`${profile.name} is now the active fit profile.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function newProfile() {
    setProfileId(undefined);
    setName("");
    setUnit("in");
    setMeasurements({});
    setStatus("");
  }

  function deleteProfile(id: string) {
    removeCustomerMeasurementProfile(id);
    setProfiles(listCustomerMeasurementProfiles());
    if (profileId === id) newProfile();
  }

  return (
    <section className="customerMeasurements">
      <div className="customerMeasureIntro">
        <div>
          <span className="micro">LOCAL CUSTOMER PROFILE</span>
          <h2>Measurements that travel with the design.</h2>
          <p>Save named profiles on this device, then use the active profile inside the existing Designer Engine. Final cutting measurements should still be verified in the shop.</p>
        </div>
        <div className="measureUnitChoice" aria-label="Measurement unit">
          <button className={unit === "in" ? "active" : ""} onClick={() => setUnit("in")}>INCH</button>
          <button className={unit === "cm" ? "active" : ""} onClick={() => setUnit("cm")}>CM</button>
        </div>
      </div>

      <div className="customerMeasureWorkbench">
        <div className="customerMeasureForm">
          <div className="customerNameRow">
            <label>
              <span>CUSTOMER NAME</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Slok Patel" />
            </label>
            <button onClick={newProfile}>New profile</button>
          </div>

          <div className="customerMeasureGrid">
            {customerMeasurementFields.map((field) => {
              const cm = measurements[field.key];
              const unitMin = unit === "in" ? 0.01 : 0.1;
              const unitMax = unit === "in" ? 100 : 254;
              const unitStep = unit === "in" ? 0.01 : 0.1;
              const guideMin = measurementFromCm(field.guideMinCm, unit);
              const guideMax = measurementFromCm(field.guideMaxCm, unit);
              const fallback = (guideMin + guideMax) / 2;
              const sliderValue = cm == null ? fallback : Math.min(unitMax, Math.max(unitMin, measurementFromCm(cm, unit)));
              const fill = ((sliderValue - unitMin) / (unitMax - unitMin)) * 100;
              const outsideGuide = cm != null && (cm < field.guideMinCm || cm > field.guideMaxCm);
              return (
                <article className={`customerMeasureCard ${field.required ? "required" : "optional"}`} key={field.key}>
                  <div className="customerMeasureCardHead">
                    <div><span>{field.required ? "REQUIRED" : "OPTIONAL"}</span><h3>{field.label}</h3></div>
                    <strong>{displayValue(cm)}</strong>
                  </div>
                  <input
                    type="range"
                    min={unitMin}
                    max={unitMax}
                    step={unitStep}
                    value={sliderValue}
                    onChange={(event) => setMeasurement(field.key, Number(event.target.value))}
                    style={{ "--profile-fill": `${fill}%` } as CSSProperties}
                    aria-label={`${field.label} in ${unit}`}
                  />
                  <div className="customerMeasureScale"><span>{unitMin}</span><span>guide {guideMin.toFixed(1)}–{guideMax.toFixed(1)} {unit}</span><span>{unitMax} {unit}</span></div>
                  <div className="customerMeasureCardFoot">
                    <small>{outsideGuide ? "Outside usual tailoring guide — recheck before saving." : cm == null ? "Move the scale to capture this measurement." : "Captured."}</small>
                    {cm != null && <button onClick={() => clearMeasurement(field.key)}>Clear</button>}
                  </div>
                </article>
              );
            })}
          </div>

          {status && <p className="customerMeasureStatus">{status}</p>}
          <div className="customerMeasureActions">
            <button className="customerMeasureSave" onClick={saveProfile}>Save & use profile</button>
            <Link href="/designer-brief">Continue to Design for me <span>→</span></Link>
          </div>
          <p className="customerMeasurePrivacy">MVP storage: profiles stay in this browser&apos;s localStorage on this device. They are not a production customer account or cloud record.</p>
        </div>

        <aside className="savedCustomerProfiles">
          <div className="savedProfilesHead"><span className="micro">SAVED ON THIS DEVICE</span><strong>{profiles.length}</strong></div>
          {profiles.length === 0 ? <div className="savedProfilesEmpty"><h3>No customer profiles yet.</h3><p>Complete the four required measurements and save the first profile.</p></div> : profiles.map((profile) => (
            <article className={profile.id === profileId ? "active" : ""} key={profile.id}>
              <div><span>{new Date(profile.updatedAt).toLocaleDateString()}</span><h3>{profile.name}</h3><p>{profileMeasurementSummary(profile)}</p></div>
              <div className="savedProfileActions">
                <button onClick={() => loadProfile(profile)}>Use profile</button>
                <a href={buildWhatsAppUrl({ topic: "Measurement profile and tailoring", customerName: profile.name, details: profileMeasurementSummary(profile) })} target="_blank" rel="noreferrer">WhatsApp</a>
                <button className="remove" onClick={() => deleteProfile(profile.id)}>Delete</button>
              </div>
            </article>
          ))}
        </aside>
      </div>
    </section>
  );
}
