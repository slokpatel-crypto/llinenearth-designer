export type WhatsAppEnquiry = {
  topic?: string;
  garment?: string;
  customerName?: string;
  details?: string;
};

export const WHATSAPP_BUSINESS_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
export const WHATSAPP_NUMBER_CONFIGURED = WHATSAPP_BUSINESS_NUMBER.length >= 10;

export function buildWhatsAppMessage(input: WhatsAppEnquiry = {}) {
  const lines = ["Hi LLinen Earth, I would like help with a premium tailoring enquiry."];
  if (input.customerName) lines.push(`Customer: ${input.customerName}`);
  if (input.topic) lines.push(`Enquiry: ${input.topic}`);
  if (input.garment) lines.push(`Garment: ${input.garment}`);
  if (input.details) lines.push(input.details);
  lines.push("Please help me with the next step and a visit to the Bhiwandi shop.");
  return lines.join("\n");
}

export function buildWhatsAppUrl(input: WhatsAppEnquiry = {}) {
  const text = encodeURIComponent(buildWhatsAppMessage(input));
  return WHATSAPP_NUMBER_CONFIGURED
    ? `https://wa.me/${WHATSAPP_BUSINESS_NUMBER}?text=${text}`
    : `https://wa.me/?text=${text}`;
}
