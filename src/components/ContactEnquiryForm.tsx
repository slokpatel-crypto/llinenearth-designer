"use client";

import { useState } from "react";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import styles from "./ContactEnquiryForm.module.css";

const GARMENTS = ["Shirt", "Trouser", "Kurta", "Nehru jacket", "Indo-western", "Other"] as const;

/** Creates a customer-controlled draft: no order, stock or price is promised. */
export function ContactEnquiryForm() {
  const [customerName, setCustomerName] = useState("");
  const [garment, setGarment] = useState("");
  const [details, setDetails] = useState("");
  const href = buildWhatsAppUrl({
    topic: "Fabric and tailoring consultation",
    customerName,
    garment,
    details,
  });

  return (
    <div className={styles.form} role="group" aria-label="Prepare a WhatsApp tailoring enquiry">
      <div className={styles.row}>
        <label className={styles.field}>
          <span>Your name <em>(optional)</em></span>
          <input
            type="text"
            autoComplete="name"
            maxLength={70}
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Name"
          />
        </label>
        <label className={styles.field}>
          <span>Garment</span>
          <select value={garment} onChange={(event) => setGarment(event.target.value)}>
            <option value="">Not decided yet</option>
            {GARMENTS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <label className={styles.field}>
        <span>What do you need? <em>(optional)</em></span>
        <textarea
          rows={3}
          maxLength={240}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="E.g. wedding in December, looking for blue linen shirting."
        />
      </label>
      <a className={styles.submit} href={href} target="_blank" rel="noopener noreferrer">
        Open WhatsApp with enquiry <span aria-hidden="true">↗</span>
      </a>
      <p className={styles.note}>Your details open as a WhatsApp draft. No message is sent until you choose to send it.</p>
    </div>
  );
}
