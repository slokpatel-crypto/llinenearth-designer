import { NextResponse } from "next/server";
import { FABRIC_STOCK } from "@/lib/fabric-stock";

export async function GET() {
  const byLine = FABRIC_STOCK.reduce<Record<string, number>>((acc, fabric) => {
    acc[fabric.line] = (acc[fabric.line] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    version: 1,
    generatedAt: new Date().toISOString(),
    totals: {
      fabrics: FABRIC_STOCK.length,
      inStock: FABRIC_STOCK.filter((fabric) => fabric.inStock).length,
      lines: Object.keys(byLine).length,
    },
    byLine,
    fabrics: FABRIC_STOCK,
  });
}
