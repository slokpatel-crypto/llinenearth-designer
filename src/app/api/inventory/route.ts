import { NextResponse } from "next/server";
import { FABRIC_STOCK } from "@/lib/fabric-stock";
import { LEGACY_WEBSITE_STOCK } from "@/lib/legacy-website-stock";
import { applyLiveVerifiedStockAvailability } from "@/lib/designer/stock-availability-server";
import { requireVerifiedPublicAvailability } from "@/lib/designer/public-inventory-availability";
import { legacyFabricsFromScan, scanLegacySite } from "@/lib/legacy-site-inventory";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

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

  // Catalogue swatches are not physical availability. A missing, malformed or
  // unreachable verified ledger must never advertise any of them as in stock.
  const verified = await applyLiveVerifiedStockAvailability(FABRIC_STOCK);
  const structured = requireVerifiedPublicAvailability(verified.stock, verified.verifiedFabricIds);
  // Legacy gallery scans prove only that images exist, never supplier metres.
  const legacySwatches = requireVerifiedPublicAvailability(legacy, []);
  const fabrics = [...structured, ...legacySwatches];
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
      inStock: structured.filter((fabric) => fabric.inStock).length,
      lines: Object.keys(byLine).length,
    },
    byLine,
    fabrics,
  }, { headers: { "cache-control": "no-store" } });
}
