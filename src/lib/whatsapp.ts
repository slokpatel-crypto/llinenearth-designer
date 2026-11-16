export type WhatsAppEnquiry = {
  topic?: string;
  garment?: string;
  customerName?: string;
  details?: string;
};

const DEFAULT_WHATSAPP_NUMBER = "919226338282";

/** WhatsApp click-to-chat requires digits in international format, without extensions. */
export function normalizeWhatsAppBusinessNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\+?[0-9\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  // The shop is in India; allow its 10-digit local mobile number in configuration.
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  return /^[1-9]\d{9,14}$/.test(digits) ? digits : null;
}

/** Never lose customer enquiries to wa.me links lacking a recipient. */
export function resolveWhatsAppBusinessNumber(value: unknown): string {
  return normalizeWhatsAppBusinessNumber(value) ?? DEFAULT_WHATSAPP_NUMBER;
}

export const WHATSAPP_BUSINESS_NUMBER = resolveWhatsAppBusinessNumber(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER);
export const WHATSAPP_NUMBER_CONFIGURED = Boolean(WHATSAPP_BUSINESS_NUMBER);

/** External enquiry fields must not inject extra message lines or create huge URLs. */
function enquiryField(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  const singleLine = value
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060\u2066-\u2069\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(singleLine).slice(0, maxLength).join("");
}

export function buildWhatsAppMessage(input: WhatsAppEnquiry = {}) {
  const lines = ["Hi Linen Earth, I would like help with a premium tailoring enquiry."];
  const customerName = enquiryField(input.customerName, 70);
  const topic = enquiryField(input.topic, 100);
  const garment = enquiryField(input.garment, 70);
  const details = enquiryField(input.details, 240);
  if (customerName) lines.push(`Customer: ${customerName}`);
  if (topic) lines.push(`Enquiry: ${topic}`);
  if (garment) lines.push(`Garment: ${garment}`);
  if (details) lines.push(details);
  lines.push("Please help me with the next step and a visit to the Bhiwandi shop.");
  return lines.join("\n");
}

export function buildWhatsAppUrl(input: WhatsAppEnquiry = {}) {
  const text = encodeURIComponent(buildWhatsAppMessage(input));
  return `https://wa.me/${WHATSAPP_BUSINESS_NUMBER}?text=${text}`;
}
