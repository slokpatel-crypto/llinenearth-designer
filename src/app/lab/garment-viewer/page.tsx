import Link from "next/link";
import Script from "next/script";
import GarmentViewer, { type GarmentViewerFabric } from "@/components/GarmentViewer";
import { FABRIC_STOCK } from "@/lib/fabric-stock";
import { loadGarmentViewerProductionAssetStatus } from "@/lib/garment-viewer-model-server";
import { PROTOTYPE_MODEL_ID } from "@/lib/garment-viewer-prototype";
import { loadActiveDesignerFabricStock } from "@/lib/designer/catalog-stock-server";
import { composeViewerPreviewStock } from "@/lib/designer/viewer-preview-stock";
import "./garment-viewer.css";

export const metadata={
  title:"GarmentViewer M7.46 · Linen Earth",
  description:"Linen Earth locked 3D mannequin with live fabric mapping and tailoring construction variants.",
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
    drape:fabric.drape,
    weightClass:fabric.weightClass,
    weightGsm:fabric.weightGsm,
    weave:fabric.weave,
    availabilityVerified:fabric.inStock===true && fabric.availabilityVerified===true,
  };
}

export default async function GarmentViewerLabPage() {
  const production=await loadGarmentViewerProductionAssetStatus();
  const live=await loadActiveDesignerFabricStock();
  // Internal prototype lab: preserve full Designer recipe reconstruction even
  // when supplier/ledger/operator evidence is absent. Unverified swatches are
  // explicitly preview-only; the customer live catalogue remains fail-closed.
  const previewStock=composeViewerPreviewStock(FABRIC_STOCK,live.stock);
  // `configured` only means a path was supplied; the file may be missing or
  // fail structural/identity manifest preflight. Never offer that URL as an
  // approved 3D model. The internal lab can still inspect its named prototype.
  const approvedModelSrc=production.assetReady ? production.modelSrc : null;
  // Keep the existing sophisticated M7 tailoring geometry in the *internal*
  // lab only, explicitly unapproved. Never collapse back to a cube just to
  // satisfy a production gate or assign a production asset identity to it.
  const candidateModelSrc=!production.assetReady && production.model?.placeholderGeometry
    && production.model.contract.readiness==="contract_ready" && production.manifest?.valid
    ? production.modelSrc : null;
  const previewModelSrc=approvedModelSrc || candidateModelSrc;
  const modelManifestSrc=previewModelSrc ? production.manifestSrc : null;
  const modelId=previewModelSrc ? production.modelId : PROTOTYPE_MODEL_ID;
  const shirtFabrics=previewStock.filter((fabric)=>fabric.suitableFor.includes("shirt")).map(viewerFabric);
  const trouserFabrics=previewStock.filter((fabric)=>fabric.suitableFor.includes("trouser")).map(viewerFabric);

  return <>
    <Script
      id="linen-earth-model-viewer"
      type="module"
      src="/vendor/model-viewer"
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
    <main className="garmentViewerPage">
      <header className="garmentViewerHeader">
        <Link href="/style-director" aria-label="Back to Style Director">← Style Director</Link>
        <div><span>LINEN EARTH · DEEP ENGINE</span><b>3D VIEWER LAB</b></div>
        <Link href="/designer-studio">Designer Studio ↗</Link>
      </header>
      <p role="note" className="garmentViewerStockNotice">Preview only — the 3D lab keeps catalogue fabrics selectable for reconstructing saved designs. {live.stock.length} fabrics currently have both verified positive ledger stock and operator approval; all other fabrics need a fresh stock check before an enquiry or order. No cloth is reserved by this preview.</p>
      <GarmentViewer shirtFabrics={shirtFabrics} trouserFabrics={trouserFabrics} modelSrc={previewModelSrc} modelManifestSrc={modelManifestSrc} modelId={modelId} assetIdentity={production.assetIdentity}/>
    </main>
  </>;
}
