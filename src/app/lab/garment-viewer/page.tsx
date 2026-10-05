import Link from "next/link";
import Script from "next/script";
import GarmentViewer, { type GarmentViewerFabric } from "@/components/GarmentViewer";
import { FABRIC_STOCK } from "@/lib/fabric-stock";
import { loadGarmentViewerProductionAssetStatus } from "@/lib/garment-viewer-model-server";
import { PROTOTYPE_MODEL_ID } from "@/lib/garment-viewer-prototype";
import "./garment-viewer.css";

export const metadata={
  title:"GarmentViewer M2 · Linen Earth",
  description:"Reusable 3D garment material-mapping proof for Linen Earth.",
  robots:{index:false,follow:false},
};

function viewerFabric(fabric:(typeof FABRIC_STOCK)[number]):GarmentViewerFabric {
  const file=fabric.swatchImageUrl.split("/").pop() || "";
  const tileKey=file.replace(/\.webp$/i,"");
  return {
    id:fabric.id,
    name:fabric.colorName,
    line:fabric.line,
    image:`/fabric-tiles/${tileKey}.webp`,
    tileKey,
  };
}

export default async function GarmentViewerLabPage() {
  const production=await loadGarmentViewerProductionAssetStatus();
  const approvedModelSrc=production.configured ? production.modelSrc : null;
  const modelManifestSrc=production.configured ? production.manifestSrc : null;
  const modelId=approvedModelSrc ? production.modelId : PROTOTYPE_MODEL_ID;
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
      <GarmentViewer shirtFabrics={shirtFabrics} trouserFabrics={trouserFabrics} modelSrc={approvedModelSrc} modelManifestSrc={modelManifestSrc} modelId={modelId} assetIdentity={production.assetIdentity}/>
    </main>
  </>;
}
