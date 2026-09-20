import { NextResponse } from "next/server";
import { FABRIC_STOCK } from "@/lib/fabric-stock";
import { LEGACY_WEBSITE_STOCK } from "@/lib/legacy-website-stock";
import { legacyFabricsFromScan, scanLegacySite } from "@/lib/legacy-site-inventory";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  let legacy = LEGACY_WEBSITE_STOCK;
  let legacySource: "live" | "bundled-fallback" = "bundled-fallback";

  try {
    const scan = await scanLegacySite();
    const live = legacyFabricsFromScan(scan.categories);
    if (live.length) {
      legacy = live;
      legacySource = "live";
    }
  } catch (error) {
    console.warn("[inventory] legacy scan fallback", error);
  }

  const fabrics = [...FABRIC_STOCK, ...legacy];
  const byLine = fabrics.reduce<Record<string, number>>((acc, fabric) => {
    acc[fabric.line] = (acc[fabric.line] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    version: 3,
    generatedAt: new Date().toISOString(),
    legacySource,
    totals: {
      fabrics: fabrics.length,
      confirmedStructured: FABRIC_STOCK.length,
      legacyWebsiteSwatches: legacy.length,
      inStock: FABRIC_STOCK.filter((fabric) => fabric.inStock).length,
      lines: Object.keys(byLine).length,
    },
    byLine,
    fabrics,
  });
}
