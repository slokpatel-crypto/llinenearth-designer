import Link from "next/link";
import Script from "next/script";
import GarmentViewer, { type GarmentViewerFabric } from "@/components/GarmentViewer";
import { FABRIC_STOCK } from "@/lib/fabric-stock";
import "./garment-viewer.css";

export const metadata={
  title:"GarmentViewer M1 · Linen Earth",
  description:"Reusable 3D garment material-mapping proof for Linen Earth.",
};

function viewerFabric(fabric:(typeof FABRIC_STOCK)[number]):GarmentViewerFabric {
  return {
    id:fabric.id,
    name:fabric.colorName,
    line:fabric.line,
    image:fabric.swatchImageUrl,
  };
}

export default function GarmentViewerLabPage() {
  const shirtFabrics=FABRIC_STOCK.filter((fabric)=>fabric.inStock&&fabric.suitableFor.includes("shirt")).slice(0,10).map(viewerFabric);
  const trouserFabrics=FABRIC_STOCK.filter((fabric)=>fabric.inStock&&fabric.suitableFor.includes("trouser")).slice(0,10).map(viewerFabric);

  return <>
    <Script
      id="linen-earth-model-viewer"
      type="module"
      src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.3.1/model-viewer.min.js"
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
    <main className="garmentViewerPage">
      <header className="garmentViewerHeader">
        <Link href="/style-director" aria-label="Back to Style Director">← Style Director</Link>
        <div><span>LINEN EARTH · DEEP ENGINE</span><b>3D VIEWER LAB</b></div>
        <Link href="/designer-studio">Designer Studio ↗</Link>
      </header>
      <GarmentViewer shirtFabrics={shirtFabrics} trouserFabrics={trouserFabrics}/>
    </main>
  </>;
}
