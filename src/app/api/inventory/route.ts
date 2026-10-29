import { NextResponse } from "next/server";
import { loadDesignerFabricMetadata, applyDesignerFabricMetadataToStock } from "@/lib/designer-fabric-metadata";
import { applyLiveVerifiedStockAvailability } from "@/lib/designer/stock-availability-server";
import { LEGACY_WEBSITE_STOCK } from "@/lib/legacy-website-stock";
import { legacyFabricsFromScan, scanLegacySite } from "@/lib/legacy-site-inventory";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function GET() {
  // The old catalogue uses optimistic inStock flags that are NOT physical receipts.
  // Keep this older inventory API aligned with the fail-closed Designer catalogue:
  // only live, provenance-verified ledger rows may promote physical availability.
  const metadata = await loadDesignerFabricMetadata();
  const liveStock = await applyLiveVerifiedStockAvailability(applyDesignerFabricMetadataToStock(metadata));

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

  const fabrics = [...liveStock.stock, ...legacy];
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
      confirmedStructured: liveStock.stock.length,
      legacyWebsiteSwatches: legacy.length,
      inStock: fabrics.filter((fabric) => fabric.inStock).length,
      verifiedStockFabrics: liveStock.verifiedFabricIds.length,
      lines: Object.keys(byLine).length,
    },
    byLine,
    fabrics,
  }, { headers: { "cache-control": "private, no-store" } });
}
