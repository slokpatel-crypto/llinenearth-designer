import type { FabricProfile } from "@/lib/fabric-analysis";

export type GarmentKind = "shirt" | "trouser" | "suit" | "blazer";

export interface FabricColorway {
  id: string;
  family: string;
  line: string;
  colorName: string;
  hex: string;
  swatchImageUrl: string;
  suitableFor: GarmentKind[];
  pattern: string;
  compositionNote?: string;
  sourceDocument: string;
  sourcePage: number;
  inStock: boolean;
}

const shirt: GarmentKind[] = ["shirt"];
const suiting: GarmentKind[] = ["trouser", "suit", "blazer"];

function stock(
  id: string,
  line: string,
  colorName: string,
  hex: string,
  image: string,
  suitableFor: GarmentKind[],
  pattern: string,
  sourceDocument: string,
  sourcePage: number,
  compositionNote?: string,
): FabricColorway {
  return {
    id,
    family: "Linen",
    line,
    colorName,
    hex,
    swatchImageUrl: `/fabrics/${image}.webp`,
    suitableFor,
    pattern,
    compositionNote,
    sourceDocument,
    sourcePage,
    inStock: true,
  };
}

export const FABRIC_STOCK: FabricColorway[] = [
  stock("linen-plain-60-sky-blue", "Linen Plain 60 Lea", "Sky Blue", "#839197", "plain-60-01", shirt, "Plain", "Linen plain colors 60lea.pdf", 1),
  stock("linen-plain-60-peach", "Linen Plain 60 Lea", "Peach", "#A58F7F", "plain-60-02", shirt, "Plain", "Linen plain colors 60lea.pdf", 2),
  stock("linen-plain-60-stresa", "Linen Plain 60 Lea", "Stresa", "#4A5659", "plain-60-03", shirt, "Plain", "Linen plain colors 60lea.pdf", 3),
  stock("linen-plain-60-boulder-gray", "Linen Plain 60 Lea", "Boulder Gray", "#4F4D50", "plain-60-04", shirt, "Plain", "Linen plain colors 60lea.pdf", 4),
  stock("linen-plain-60-oyster-pink", "Linen Plain 60 Lea", "Oyster Pink", "#9D8286", "plain-60-05", shirt, "Plain", "Linen plain colors 60lea.pdf", 5),
  stock("linen-plain-60-khakhi", "Linen Plain 60 Lea", "Khakhi", "#928776", "plain-60-06", shirt, "Plain", "Linen plain colors 60lea.pdf", 6),
  stock("linen-plain-60-jute-black", "Linen Plain 60 Lea", "Black - Jute Feel", "#403D43", "plain-60-07", shirt, "Plain / jute feel", "Linen plain colors 60lea.pdf", 7),
  stock("linen-plain-60-jute-maroon", "Linen Plain 60 Lea", "Maroon - Jute Feel", "#753745", "plain-60-08", shirt, "Plain / jute feel", "Linen plain colors 60lea.pdf", 8),
  stock("linen-plain-60-jute-offwhite", "Linen Plain 60 Lea", "Offwhite - Jute Feel", "#A19C97", "plain-60-09", shirt, "Plain / jute feel", "Linen plain colors 60lea.pdf", 9),
  stock("linen-plain-60-saffron", "Linen Plain 60 Lea", "Saffron", "#B0522D", "plain-60-10", shirt, "Plain", "Linen plain colors 60lea.pdf", 10),
  stock("linen-plain-60-dijon-yellow", "Linen Plain 60 Lea", "Dijon Yellow", "#BDA56A", "plain-60-11", shirt, "Plain", "Linen plain colors 60lea.pdf", 11),
  stock("linen-plain-60-light-green", "Linen Plain 60 Lea", "Light Green", "#7FAE66", "plain-60-12", shirt, "Plain", "Linen plain colors 60lea.pdf", 12),
  stock("linen-plain-60-light-grey", "Linen Plain 60 Lea", "Light Grey", "#98979B", "plain-60-13", shirt, "Plain", "Linen plain colors 60lea.pdf", 13),

  stock("linen-print-60-01", "Linen Print 60 Lea", "Printed Linen 01", "#5C7085", "print-60-1", shirt, "Botanical print", "Linen Print 60lea.pdf", 1),
  stock("linen-print-60-02", "Linen Print 60 Lea", "Printed Linen 02", "#A7A3A2", "print-60-2", shirt, "Geometric medallion print", "Linen Print 60lea.pdf", 2),
  stock("linen-print-60-03", "Linen Print 60 Lea", "Printed Linen 03", "#B1B1AF", "print-60-3", shirt, "Leaf print", "Linen Print 60lea.pdf", 3),
  stock("linen-print-60-04", "Linen Print 60 Lea", "Printed Linen 04", "#8B6868", "print-60-4", shirt, "Floral print", "Linen Print 60lea.pdf", 4),
  stock("linen-print-60-05", "Linen Print 60 Lea", "Printed Linen 05", "#B6988E", "print-60-5", shirt, "Block-inspired print", "Linen Print 60lea.pdf", 5),
  stock("linen-print-60-06", "Linen Print 60 Lea", "Printed Linen 06", "#A9A9A5", "print-60-6", shirt, "Botanical print", "Linen Print 60lea.pdf", 6),
  stock("linen-print-60-07", "Linen Print 60 Lea", "Printed Linen 07", "#A29E9C", "print-60-7", shirt, "Geometric mosaic print", "Linen Print 60lea.pdf", 7),
  stock("linen-print-60-08", "Linen Print 60 Lea", "Printed Linen 08", "#A59D97", "print-60-8", shirt, "Chevron print", "Linen Print 60lea.pdf", 8),

  stock("printed-linen-blend-01", "Printed Linen Blend", "Printed Linen Blend 01", "#8E8375", "printed-blend-1", shirt, "Heritage floral print", "Printed linen blend fabric.pdf", 1, "Linen blend - exact fibre percentages not supplied"),
  stock("printed-linen-blend-02", "Printed Linen Blend", "Printed Linen Blend 02", "#767677", "printed-blend-2", shirt, "Abstract print", "Printed linen blend fabric.pdf", 2, "Linen blend - exact fibre percentages not supplied"),
  stock("printed-linen-blend-03", "Printed Linen Blend", "Printed Linen Blend 03", "#969690", "printed-blend-3", shirt, "Micro floral print", "Printed linen blend fabric.pdf", 3, "Linen blend - exact fibre percentages not supplied"),
  stock("printed-linen-blend-04", "Printed Linen Blend", "Printed Linen Blend 04", "#8E8F8D", "printed-blend-4", shirt, "Tonal botanical print", "Printed linen blend fabric.pdf", 4, "Linen blend - exact fibre percentages not supplied"),
  stock("printed-linen-blend-05", "Printed Linen Blend", "Printed Linen Blend 05", "#8E8F8E", "printed-blend-5", shirt, "Floral print", "Printed linen blend fabric.pdf", 5, "Linen blend - exact fibre percentages not supplied"),
  stock("printed-linen-blend-06", "Printed Linen Blend", "Printed Linen Blend 06", "#767072", "printed-blend-6", shirt, "Floral print", "Printed linen blend fabric.pdf", 6, "Linen blend - exact fibre percentages not supplied"),
  stock("printed-linen-blend-07", "Printed Linen Blend", "Printed Linen Blend 07", "#888984", "printed-blend-7", shirt, "Geometric floral print", "Printed linen blend fabric.pdf", 7, "Linen blend - exact fibre percentages not supplied"),
  stock("printed-linen-blend-08", "Printed Linen Blend", "Printed Linen Blend 08", "#9B989B", "printed-blend-8", shirt, "Botanical print", "Printed linen blend fabric.pdf", 8, "Linen blend - exact fibre percentages not supplied"),

  ...[
    ["01", "#908C88", "Stripe"], ["02", "#949293", "Windowpane check"], ["03", "#548589", "Stripe"], ["04", "#9DA79D", "Check"],
    ["05", "#A2A4AE", "Check"], ["06", "#A7A3A0", "Check"], ["07", "#818B7E", "Micro check"], ["08", "#A8A6A5", "Stripe"],
    ["09", "#ACAAAA", "Fine stripe"], ["10", "#A3A1A2", "Stripe"], ["11", "#908F94", "Windowpane check"], ["12", "#7B7F8A", "Textured check"],
    ["13", "#3D81D6", "Pinstripe"], ["14", "#9F9D98", "Check"], ["15", "#A4A398", "Windowpane check"], ["16", "#98937C", "Check"],
    ["17", "#AC2E58", "Windowpane check"], ["18", "#848D78", "Micro check"], ["19", "#99988D", "Stripe"], ["20", "#9E9C9B", "Stripe"],
    ["21", "#9E9A9A", "Check"],
  ].map(([number, hex, pattern], index) => stock(
    `formal-shirting-${number}`,
    "Linen Formal Shirting 60/75 Lea",
    `Formal Shirting ${number}`,
    hex,
    `formal-shirts-${number}`,
    shirt,
    pattern,
    "linen 60 and 75 lea formal shirts.pdf",
    index + 1,
  )),

  stock("linen-suiting-dark-grey", "Linen Suiting", "Dark Grey", "#69696C", "suiting-01", suiting, "Plain", "linen suiting.pdf", 1),
  stock("linen-suiting-orchid", "Linen Suiting", "Orchid", "#9A5C8D", "suiting-02", suiting, "Plain", "linen suiting.pdf", 2),
  stock("linen-suiting-denim-blue", "Linen Suiting", "Denim Blue", "#6B7493", "suiting-03", suiting, "Plain", "linen suiting.pdf", 3),
  stock("linen-suiting-slate-gray", "Linen Suiting", "Slate Gray", "#929195", "suiting-04", suiting, "Plain", "linen suiting.pdf", 4),
  stock("linen-suiting-charcoal-grey", "Linen Suiting", "Charcoal Grey", "#7E8082", "suiting-05", suiting, "Plain", "linen suiting.pdf", 5),
  stock("linen-suiting-charcoal-oak-wood", "Linen Suiting", "Charcoal Oak Wood", "#65615D", "suiting-06", suiting, "Plain", "linen suiting.pdf", 6),
  stock("linen-suiting-light-cream", "Linen Suiting", "Light Cream", "#AAA69B", "suiting-07", suiting, "Plain", "linen suiting.pdf", 7),
  stock("linen-suiting-chambray-blue-01", "Linen Suiting", "Chambray Blue 01", "#7D818D", "suiting-08", suiting, "Plain", "linen suiting.pdf", 8),
  stock("linen-suiting-taupe-beige", "Linen Suiting", "Taupe Beige", "#B6B3B1", "suiting-09", suiting, "Plain", "linen suiting.pdf", 9),
  stock("linen-suiting-perfect-taupe", "Linen Suiting", "Perfect Taupe", "#A89E94", "suiting-10", suiting, "Plain", "linen suiting.pdf", 10),
  stock("linen-suiting-platinum", "Linen Suiting", "Platinum", "#A4A2A1", "suiting-11", suiting, "Plain", "linen suiting.pdf", 11),
  stock("linen-suiting-beige", "Linen Suiting", "Beige", "#B1A68E", "suiting-12", suiting, "Plain", "linen suiting.pdf", 12),
  stock("linen-suiting-baby-pink", "Linen Suiting", "Baby Pink", "#A69C9C", "suiting-13", suiting, "Plain", "linen suiting.pdf", 13),
  stock("linen-suiting-turkish-rose", "Linen Suiting", "Turkish Rose", "#8B7871", "suiting-14", suiting, "Plain", "linen suiting.pdf", 14),
  stock("linen-suiting-muted-cool-gray", "Linen Suiting", "Muted Cool Gray", "#9E9C9E", "suiting-15", suiting, "Plain", "linen suiting.pdf", 15),
  stock("linen-suiting-chambray-blue-02", "Linen Suiting", "Chambray Blue 02", "#8D8F96", "suiting-16", suiting, "Plain", "linen suiting.pdf", 16),
];

function normalizeGarment(garment: string): GarmentKind | null {
  const value = garment.trim().toLowerCase();
  if (value.startsWith("shirt")) return "shirt";
  if (value.startsWith("trouser") || value.startsWith("pant")) return "trouser";
  if (value.startsWith("suit")) return "suit";
  if (value.startsWith("blazer") || value.includes("jacket")) return "blazer";
  return null;
}

export function fabricOptionsForGarment(garment: string): FabricColorway[] {
  const normalized = normalizeGarment(garment);
  if (!normalized) return FABRIC_STOCK.filter((fabric) => fabric.inStock);
  return FABRIC_STOCK.filter((fabric) => fabric.suitableFor.includes(normalized) && fabric.inStock);
}

function adjustHex(hex: string, amount: number) {
  const number = Number.parseInt(hex.slice(1), 16);
  const channels = [(number >> 16) & 255, (number >> 8) & 255, number & 255]
    .map((value) => Math.max(0, Math.min(255, value + amount)).toString(16).padStart(2, "0"));
  return `#${channels.join("")}`;
}

export function fabricProfileFromStock(fabric: FabricColorway): FabricProfile {
  const basis = "user_confirmed" as const;
  return {
    id: `STOCK-${fabric.id}`,
    source: "stock_catalog",
    summary: `${fabric.colorName} from the ${fabric.line} range. This LLinen Earth stock reference is catalogued as ${fabric.pattern.toLowerCase()} linen.`,
    observations: [
      { label: "Likely material family", value: fabric.family, confidence: 1, confidenceLabel: "high", basis },
      { label: "Dominant color", value: fabric.colorName, confidence: 1, confidenceLabel: "high", basis },
      { label: "Pattern structure", value: fabric.pattern, confidence: 1, confidenceLabel: "high", basis },
      { label: "Stock line", value: fabric.line, confidence: 1, confidenceLabel: "high", basis },
      { label: "Catalogue reference", value: `${fabric.sourceDocument} · page ${fabric.sourcePage}`, confidence: 1, confidenceLabel: "high", basis },
    ],
    palette: [fabric.hex, adjustHex(fabric.hex, -28), adjustHex(fabric.hex, 28), adjustHex(fabric.hex, 56)],
    alternatives: [{ family: fabric.family, confidence: 1, evidence: ["Selected from LLinen Earth stock."] }],
    cautions: [fabric.compositionNote || "The fabric family and color are taken from the supplied LLinen Earth catalogue; final tone can vary slightly with screen and lighting."],
  };
}
