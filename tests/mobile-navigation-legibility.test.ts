import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("premium phone navigation keeps five destinations with readable labels",()=>{
  const shell=readFileSync("src/components/AppShell.tsx","utf8");
  const css=readFileSync("src/app/premium-atelier.css","utf8");
  assert.match(shell,/className="atelierMobileDock"/);
  for(const label of ["Real Model Designer","Style Director","Measurements","My Account","Contact"]){
    assert.ok(shell.includes(`["${label}",`),label);
  }
  assert.match(css,/\.premiumAtelier \.atelierMobileDock \{ grid-template-columns: 1\.25fr 1fr 1fr \.85fr \.75fr; \}/);
  assert.match(css,/\.premiumAtelier \.atelierMobileDock a \{ font-size: 11px; line-height: 1\.15; padding-inline: 3px; \}/);
});

test("phone pages reserve clearance beneath fixed navigation and enquiry dock",()=>{
  const css=readFileSync("src/app/finish-polish.css","utf8");
  assert.match(css,/\.atelierContent>main\{padding-bottom:76px\}/);
  assert.match(css,/\.floatingContactDock\{right:10px;bottom:86px\}/);
});

test("skip link reaches the actual main landmark without changing model identity",()=>{
  const shell=readFileSync("src/components/AppShell.tsx","utf8");
  const layout=readFileSync("src/app/layout.tsx","utf8");
  const css=readFileSync("src/app/atelier-accessibility.css","utf8");
  assert.match(shell,/className="atelierSkipLink" href="#main-content">Skip to main content/);
  assert.match(shell,/<main id="main-content" tabIndex=\{-1\}>\{children\}<\/main>/);
  assert.match(layout,/import "\.\/atelier-accessibility\.css";/);
  assert.match(css,/\.atelierSkipLink:focus-visible\{[^}]*translateY\(0\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test("phone dock and fixed contacts reserve safe-area space with readable targets",()=>{
  const css=readFileSync("src/app/atelier-accessibility.css","utf8");
  assert.match(css,/\.premiumAtelier \.atelierMobileDock\{[^}]*env\(safe-area-inset-bottom,0px\)/);
  assert.match(css,/\.premiumAtelier \.atelierMobileDock a\{[^}]*min-height:48px;[^}]*font-size:11px/);
  assert.match(css,/\.premiumAtelier \.atelierContent>main\{[^}]*env\(safe-area-inset-bottom,0px\)/);
  assert.match(css,/\.premiumAtelier \.floatingContactDock\{[^}]*env\(safe-area-inset-bottom,0px\)/);
});

test("studio exposes readable compact proof and garment controls",()=>{
  const page=readFileSync("src/app/designer-studio/page.tsx","utf8");
  const css=readFileSync("src/app/designer-studio/accessibility.css","utf8");
  assert.match(page,/import "\.\/accessibility\.css";/);
  assert.match(css,/\.newDesigner \.newDesignerPhotoSummaryCompact span\{font-size:11px!important/);
  assert.match(css,/\.newDesigner \.newDesignerPhotoActionsCompact button\{font-size:12px!important;[^}]*min-height:44px/);
  assert.match(css,/\.newDesigner \.newDesignerPhotoSummaryCompact strong\{[^}]*white-space:normal/);
  assert.match(css,/\.newDesigner \.newDesignerGarmentScope article select\{font-size:13px;min-height:44px/);
});

test("fabric discovery, photoreal view and QA controls do not regress to 6px captions",()=>{
  const css=readFileSync("src/app/designer-studio/accessibility.css","utf8");
  assert.match(css,/\.newDesigner :is\(\.newDesignerPhotoViews button,[^}]*\)\{font-size:12px!important;[^}]*min-height:44px/);
  assert.match(css,/\.newDesigner :is\(\.newDesignerFabricFilters button,[^}]*\)\{font-size:11px!important;[^}]*min-height:44px/);
  assert.match(css,/\.newDesigner :is\(\.newDesignerSelectedQa span,[^}]*\)\{font-size:11px!important/);
  assert.match(css,/\.newDesigner \.newDesignerSelectedQaMetrics i\{white-space:normal/);
});

test("fabric and preview readiness changes are announced without claiming verified fit",()=>{
  const photo=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  const css=readFileSync("src/app/designer-studio/accessibility.css","utf8");
  assert.match(photo,/className="newDesignerSrOnly" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(photo,/previewFabricLabel\(shirt,pant\)/);
  assert.match(photo,/Fit and drape require physical verification\./);
  assert.match(css,/\.newDesigner \.newDesignerSrOnly\{[^}]*clip-path:inset\(50%\)/);
});

test("Chromium UI records actual preview-ready diagnostics without inventing a device SLA",()=>{
  const script=readFileSync("scripts/verify-premium-atelier.cjs","utf8");
  assert.match(script,/const studioStarted = Date\.now\(\)/);
  assert.match(script,/\.newDesignerPhotoStage\[data-ready="true"\]/);
  assert.match(script,/studioReadyMs = Date\.now\(\) - studioStarted/);
  assert.match(script,/not a device, cold-cache, paint SLA or physical acceptance/);
  assert.doesNotMatch(script,/assert\.ok\(studioReadyMs\s*[<>=]/);
});

test("inactive fabric filters and provisional garment/QA evidence retain readable contrast",()=>{
  const css=readFileSync("src/app/designer-studio/accessibility.css","utf8");
  assert.match(css,/\.newDesigner \.newDesignerFabricFilters button\[aria-pressed="false"\]\{color:#526575\}/);
  assert.match(css,/\.newDesigner \.newDesignerGarmentScope article\[data-status="planned"\]\{opacity:1\}/);
  assert.match(css,/\.newDesigner \.newDesignerGarmentScope article\[data-status="planned"\] :is\(span,p,small,strong\)\{color:#5f584f\}/);
  assert.match(css,/\.newDesigner \.newDesignerSelectedQa\[data-status="review"\] span\{color:#87543c\}/);
});
