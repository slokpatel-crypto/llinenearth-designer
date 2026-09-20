import { NextResponse } from "next/server";
import { FABRIC_STOCK } from "@/lib/fabric-stock";
import { LEGACY_WEBSITE_STOCK } from "@/lib/legacy-website-stock";

export async function GET() {
  const fabrics = [...FABRIC_STOCK, ...LEGACY_WEBSITE_STOCK];
  const byLine = fabrics.reduce<Record<string, number>>((acc, fabric) => {
    acc[fabric.line] = (acc[fabric.line] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    version: 2,
    generatedAt: new Date().toISOString(),
    totals: {
      fabrics: fabrics.length,
      confirmedStructured: FABRIC_STOCK.length,
      legacyWebsiteSwatches: LEGACY_WEBSITE_STOCK.length,
      inStock: FABRIC_STOCK.filter((fabric) => fabric.inStock).length,
      lines: Object.keys(byLine).length,
    },
    byLine,
    fabrics,
  });
}
