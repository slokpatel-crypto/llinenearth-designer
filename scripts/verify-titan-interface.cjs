// Real Chromium smoke for the isolated TITAN preview. No paid AI or external
// photo-render providers are contacted; all visuals are existing local assets.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createRequire } = require("node:module");

const runtime = process.env.LINEN_BROWSER_QA_RUNTIME;
if (!runtime) throw new Error("Set LINEN_BROWSER_QA_RUNTIME");
const { chromium } = createRequire(path.join(runtime, "package.json"))("playwright");
const base = process.env.LINEN_BROWSER_QA_URL || "http://127.0.0.1:3000";
const out = path.resolve("artifacts/preview-lifecycle/titan");
const widths = [320, 390, 768, 1440];
const allowedPaths = new Set(["/designer-studio", "/style-director", "/measurements", "/account"]);
const summary = { route: "/titan", status: "pilot", viewports: [], navigations: [], handoffs: [], providerCalls: [], consoleErrors: [] };
let browser;

async function waitForLocalReferences(page) {
  // DOMContentLoaded/intro dismissal do not prove the storage useEffect ran.
  // Keep persistence and corruption assertions strict after actual restoration.
  await page.locator('.titanLookbook[aria-busy="false"]').waitFor({ state: "visible", timeout: 8000 });
}

async function checkViewport(width) {
  const reducedMotion = width === 1440 ? "no-preference" : "reduce";
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion });
  const page = await context.newPage();
  page.on("pageerror", error => {
    if (new URL(page.url()).pathname === "/titan") summary.consoleErrors.push(`${width}: ${error.message}`);
  });
  page.on("request", request => {
    const uri = new URL(request.url());
    if (new URL(page.url()).pathname === "/titan" && uri.pathname.startsWith("/api/") && /render|inspect|generate|vision|fashn/i.test(uri.pathname)) {
      summary.providerCalls.push(uri.pathname);
    }
  });

  try {
    const response = await page.goto(`${base}/titan`, { waitUntil: "domcontentloaded" });
    assert.equal(response.status(), 200, "TITAN page must respond successfully");
    await page.locator(".brandIntro").waitFor({ state: "hidden", timeout: 8000 });
    await waitForLocalReferences(page);
    await page.getByRole("heading", { name: /Considered cloth/i }).waitFor();

    assert.equal(await page.title(), "The Linen Earth Studio | TITAN");
    assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow", "pilot must not be indexed");
    assert.equal(await page.locator(".titanJourneyCard").count(), 3);
    // Planning-only jacket/waistcoat/addon interactions must retain the existing
    // model; invalid dependent changes roll back as one unit, even at 320px.
    const layerPlanner = page.locator("#titan-layer-planner");
    assert.equal(await layerPlanner.locator(".titanLayerPlannerStack li").count(), 2);
    await layerPlanner.getByRole("checkbox", { name: /Blazer/ }).check();
    await layerPlanner.getByRole("radio", { name: "Two-piece suit" }).check();
    await layerPlanner.getByRole("button", { name: "Apply layer plan" }).click();
    assert.equal(await layerPlanner.locator(".titanLayerPlannerStack li").count(), 3);
    assert.equal(await layerPlanner.locator("[data-titan-composition]").getAttribute("data-titan-composition"), "two-piece-suit");
    await layerPlanner.getByRole("checkbox", { name: /Blazer/ }).uncheck();
    await layerPlanner.getByRole("button", { name: "Apply layer plan" }).click();
    assert.match(await layerPlanner.locator(".titanLayerPlannerFeedback").textContent(), /requires blazer/i);
    assert.equal(await layerPlanner.locator(".titanLayerPlannerStack li").count(), 3, "Rejected plan must keep every applied garment");
    await layerPlanner.getByRole("button", { name: "Discard edits" }).click();
    assert.equal(await layerPlanner.getByRole("checkbox", { name: /Blazer/ }).isChecked(), true);
    await layerPlanner.getByRole("checkbox", { name: /Waistcoat/ }).check();
    await layerPlanner.getByRole("radio", { name: "Three-piece suit" }).check();
    await layerPlanner.getByRole("button", { name: "Apply layer plan" }).click();
    assert.equal(await layerPlanner.locator(".titanLayerPlannerStack li").count(), 4);
    assert.equal(await layerPlanner.locator("[data-titan-composition]").getAttribute("data-titan-composition"), "three-piece-suit");
    await layerPlanner.getByRole("button", { name: "Reset plan" }).click();
    assert.equal(await layerPlanner.locator(".titanLayerPlannerStack li").count(), 2);
    assert.equal(await layerPlanner.locator("[data-titan-composition]").getAttribute("data-titan-composition"), "separates");

    // Deterministic compatibility intelligence: a missing tie prerequisite
    // offers a safe, explicit candidate but never applies it without consent.
    await layerPlanner.getByRole("checkbox", { name: /Shirt/ }).uncheck();
    await layerPlanner.getByRole("checkbox", { name: /Tie/ }).check();
    assert.match(await layerPlanner.locator(".titanLayerPlannerGuidance").textContent(), /tie requires shirt/i);
    assert.ok(await layerPlanner.locator(".titanLayerPlannerFixes button").count() >= 1);
    const repair = layerPlanner.getByRole("button", { name: "Stage fix: Add shirt", exact: true });
    assert.ok((await repair.boundingBox()).height >= 44, "Draft repair has a usable phone touch target");
    await repair.click();
    assert.equal(await layerPlanner.getByRole("checkbox", { name: /Shirt/ }).isChecked(), true);
    assert.equal(await layerPlanner.locator(".titanLayerPlannerStack li").count(), 2,
      "Staging compatibility guidance must not apply any garment");
    assert.equal(await layerPlanner.locator(".titanLayerPlannerGuidance").count(), 0,
      "The suggested draft must satisfy the exact authoritative rule engine");
    await layerPlanner.getByRole("button", { name: "Apply layer plan" }).click();
    assert.equal(await layerPlanner.locator(".titanLayerPlannerStack li").count(), 3);
    await layerPlanner.getByRole("button", { name: "Reset plan" }).click();
    assert.equal(await layerPlanner.locator(".titanLayerPlannerStack li").count(), 2);

    // A device-only bookmark is saved only on an explicit click; reload never
    // applies it to the active outfit or writes an existing Designer draft.
    const libraryKey = "linen-earth:titan-layer-plans:v1";
    const designerKey = "linen-earth:real-designer-draft:v2";
    await page.waitForFunction(() => document.querySelector(".titanLayerPlannerSave")?.disabled === false);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), libraryKey), null);
    const designerSnapshot = JSON.stringify({
      shirtId: "linen-plain-60-peach", pantId: "linen-suiting-dark-grey",
      occasion: "Casual", climate: "Hot / humid", intention: "Balanced",
    });
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value),
      { key: designerKey, value: designerSnapshot });
    await layerPlanner.getByRole("button", { name: "Save applied plan" }).click();
    assert.equal(await layerPlanner.locator(".titanLayerPlannerSavedList li").count(), 1);
    assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).plans[0], libraryKey),
      { version: 1, composition: "separates", layers: ["shirt", "trouser"] });
    await layerPlanner.getByRole("checkbox", { name: /Blazer/ }).check();
    await layerPlanner.getByRole("radio", { name: "Two-piece suit" }).check();
    await layerPlanner.getByRole("button", { name: "Apply layer plan" }).click();
    await layerPlanner.getByRole("button", { name: "Save applied plan" }).click();
    assert.equal(await layerPlanner.locator(".titanLayerPlannerSavedList li").count(), 2);
    await layerPlanner.getByRole("button", { name: "Save applied plan" }).click();
    assert.equal(await layerPlanner.locator(".titanLayerPlannerSavedList li").count(), 2,
      "Saving the same outfit must not add a duplicate");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".brandIntro").waitFor({ state: "hidden", timeout: 8000 });
    await waitForLocalReferences(page);
    await page.waitForFunction(() => document.querySelectorAll(".titanLayerPlannerSavedList li").length === 2);
    assert.equal(await layerPlanner.locator(".titanLayerPlannerStack li").count(), 2,
      "Saved outfit is never automatically applied on reload");
    await layerPlanner.getByRole("button", { name: "Load saved layer plan 2 as draft" }).click();
    assert.equal(await layerPlanner.getByRole("checkbox", { name: /Blazer/ }).isChecked(), true);
    assert.equal(await layerPlanner.locator(".titanLayerPlannerStack li").count(), 2,
      "Loading stages changes; applied plan is untouched until Apply");
    await layerPlanner.getByRole("button", { name: "Apply layer plan" }).click();
    assert.equal(await layerPlanner.locator(".titanLayerPlannerStack li").count(), 3);
    await layerPlanner.getByRole("button", { name: "Remove saved layer plan 1" }).click();
    assert.equal(await layerPlanner.locator(".titanLayerPlannerSavedList li").count(), 1);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), designerKey), designerSnapshot,
      "Layer library must not rewrite Designer draft");
    // An incompatible/corrupt store may never be silently reinterpreted or
    // overwritten, and deletion requires a separate deliberate user click.
    await page.evaluate(key => localStorage.setItem(key,
      JSON.stringify({ version: 2, plans: [{ version: 1, composition: "separates", layers: ["shirt"] }] })), libraryKey);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".brandIntro").waitFor({ state: "hidden", timeout: 8000 });
    await waitForLocalReferences(page);
    await layerPlanner.getByRole("button", { name: "Clear unreadable bookmarks" }).waitFor();
    assert.equal(await layerPlanner.getByRole("button", { name: "Save applied plan" }).isDisabled(), true);
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).version, libraryKey), 2,
      "Unknown store version must remain intact until explicit clearing");
    await layerPlanner.getByRole("button", { name: "Clear unreadable bookmarks" }).click();
    assert.equal(await page.evaluate(key => localStorage.getItem(key), libraryKey), null);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), designerKey), designerSnapshot);

    // Share is opt-in and contains only the applied logical garment plan.
    // No share link triggers 3D generation, saved Designer mutation or order.
    await layerPlanner.getByRole("button", { name: "Copy applied plan link" }).click();
    assert.equal(await layerPlanner.getByRole("textbox", { name: "Layer plan share URL" }).inputValue(),
      `${base}/titan?layer-plan=v1-0-03`);
    if (width === 390) {
      await page.goto(`${base}/titan?layer-plan=v1-2-33`, { waitUntil: "domcontentloaded" });
      await page.locator(".brandIntro").waitFor({ state: "hidden", timeout: 8000 });
      await waitForLocalReferences(page);
      await page.getByRole("checkbox", { name: /Blazer/ }).waitFor();
      await page.waitForFunction(() =>
        document.querySelector(".titanLayerPlannerFeedback")?.textContent.includes("Shared plan opened"));
      assert.equal(await layerPlanner.getByRole("checkbox", { name: /Blazer/ }).isChecked(), true);
      assert.equal(await layerPlanner.getByRole("checkbox", { name: /Waistcoat/ }).isChecked(), true);
      assert.equal(await layerPlanner.getByRole("radio", { name: "Three-piece suit" }).isChecked(), true);
      assert.equal(await layerPlanner.locator(".titanLayerPlannerStack li").count(), 2,
        "Shared link must not automatically change the applied layer plan");
      await layerPlanner.getByRole("button", { name: "Apply layer plan" }).click();
      assert.equal(await layerPlanner.locator(".titanLayerPlannerStack li").count(), 4);
      await layerPlanner.getByRole("button", { name: "Copy applied plan link" }).click();
      assert.match(await layerPlanner.getByRole("textbox", { name: "Layer plan share URL" }).inputValue(),
        /\\?layer-plan=v1-2-33$/);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), designerKey), designerSnapshot,
        "Shared layer link may not change the Designer account/draft");

      await page.goto(`${base}/titan?layer-plan=v1-1-03`, { waitUntil: "domcontentloaded" });
      await page.locator(".brandIntro").waitFor({ state: "hidden", timeout: 8000 });
      await waitForLocalReferences(page);
      await page.waitForFunction(() =>
        document.querySelector(".titanLayerPlannerFeedback")?.textContent.includes("invalid or unsupported"));
      assert.equal(await layerPlanner.locator(".titanLayerPlannerStack li").count(), 2);
      assert.equal(await layerPlanner.getByRole("checkbox", { name: /Blazer/ }).isChecked(), false);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), designerKey), designerSnapshot);
      await page.goto(`${base}/titan`, { waitUntil: "domcontentloaded" });
      await page.locator(".brandIntro").waitFor({ state: "hidden", timeout: 8000 });
      await waitForLocalReferences(page);
    }

    assert.equal(await page.locator(".titanOccasionLink").count(), 6, "Six actual Style Director occasions must be offered");
    assert.ok(await page.locator(".titanFabricCard").count() >= 8, "Real catalogue swatches must be browsable");
    assert.equal(await page.locator('.titanFabricKinds button[aria-pressed="true"]').textContent(), "Shirting");
    // Local filters do not call an image-generation provider or change the
    // customer's saved wardrobe selections merely by browsing.
    const fabricSearch = page.getByRole("searchbox", { name: "Find by colour or pattern" });
    await fabricSearch.fill("sky blue");
    assert.equal(await page.locator(".titanFabricCard").count(), 1, "Catalogue search must narrow real swatch data");
    await fabricSearch.fill("");
    assert.equal(await page.locator(".titanFabricCard").count(), 8, "Clearing search restores the initial collection");
    await fabricSearch.fill("never-a-real-fabric");
    assert.equal(await page.locator(".titanFabricCard").count(), 0);
    await page.getByRole("button", { name: "Trouser cloth" }).click();
    assert.equal(await fabricSearch.inputValue(), "", "Changing garment must clear a stale search");
    assert.equal(await page.locator(".titanFabricCard").count(), 8, "Opposite garment should be immediately browsable");
    await page.getByRole("button", { name: "Shirting", exact: true }).click();
    // Progressive discovery must avoid mounting every catalogue image at once.
    // A second batch is available on request, and both filters and collapse
    // restore the light eight-item initial view without touching saved looks.
    await page.getByRole("button", { name: /Load next 8 references/ }).click();
    assert.equal(await page.locator(".titanFabricCard").count(), 16, "Loading more adds one bounded image batch");
    await fabricSearch.fill("sky blue");
    assert.equal(await page.locator(".titanFabricCard").count(), 1, "Search resets pagination to matched results");
    await fabricSearch.fill("");
    assert.equal(await page.locator(".titanFabricCard").count(), 8, "Clearing search restores an eight-item initial batch");
    await page.getByRole("button", { name: /Load next 8 references/ }).click();
    await page.getByRole("button", { name: /Show fewer references/ }).click();
    assert.equal(await page.locator(".titanFabricCard").count(), 8, "Collapse never discards catalogue entries");
    // Comparison is a real accessible two-slot shortlist, never a simulated
    // physical colour/scale claim. Selecting a swatch here must not write a
    // saved design, call a paid provider or change the Designer counterpart.
    const compareButtons = page.locator(".titanFabricCompareButton");
    assert.equal(await compareButtons.count(), 8);
    await compareButtons.nth(0).click();
    assert.equal(await page.locator(".titanFabricComparisonItem").count(), 1);
    assert.equal(await compareButtons.nth(0).getAttribute("aria-pressed"), "true");
    await compareButtons.nth(1).click();
    assert.equal(await page.locator(".titanFabricComparisonItem").count(), 2);
    assert.equal(await page.locator(".titanFabricComparisonDetails a[href^='/designer-studio?source=titan']").count(), 2);
    assert.equal(await compareButtons.nth(2).isDisabled(), true, "Third fabric must not silently displace a choice");
    const shortListStatus = await page.locator(".titanFabricCompareStatus").textContent();
    assert.match(shortListStatus, /2 of 2 references selected/);
    await compareButtons.nth(0).click();
    assert.equal(await page.locator(".titanFabricComparisonItem").count(), 1, "Selected fabric can be removed");
    await compareButtons.nth(0).click();
    for (const image of await page.locator(".titanFabricComparisonImage img").all()) {
      await image.evaluate(img => img.decode());
      assert.ok(await image.evaluate(img => img.naturalWidth > 0), "Compared source swatches must decode");
    }
    await page.getByRole("button", { name: "Trouser cloth" }).click();
    assert.equal(await page.locator(".titanFabricComparisonItem").count(), 0, "Changing garment resets the comparison");
    await page.locator(".titanFabricCompareButton").first().click();
    assert.equal(await page.locator(".titanFabricComparisonItem").count(), 1, "Trouser comparison must use that garment's catalogue");
    await page.getByRole("button", { name: "Clear comparison" }).click();
    assert.equal(await page.locator(".titanFabricComparisonItem").count(), 0, "Clear comparison must leave no items");
    await page.getByRole("button", { name: "Shirting", exact: true }).click();
    assert.equal(await page.locator(".titanFabricCard").count(), 8, "Shirting catalogue still works after reset");
    assert.equal(await page.locator(".titanOutfitSlot").count(), 2, "One builder slot per garment");
    assert.equal(await page.locator(".titanOutfitBuildCta").count(), 0, "Incomplete outfit cannot transfer");

    // Real keyboard skip behaviour, not just a decorative anchor.
    const skip = page.getByRole("link", { name: "Skip to main content" });
    // Pointer selection above leaves Chromium in pointer modality. Prove
    // keyboard-visible focus through real Tab navigation rather than
    // asserting that a programmatic pointer-focus should show an outline.
    await skip.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await skip.evaluate(node => document.activeElement === node), true);
    assert.notEqual(await skip.evaluate(node => getComputedStyle(node).outlineStyle), "none");
    await skip.press("Enter");
    assert.equal(await page.locator("#titan-main").evaluate(node => document.activeElement === node), true, "Skip must move keyboard focus into main");

    // The compact header must remain fully operable with pointer and keyboard.
    // Unlike a screenshot, these checks verify disclosure state and escape focus.
    const menu = page.getByRole("button", { name: "Menu", exact: true });
    if (width <= 860) {
      assert.equal(await menu.isVisible(), true, "Mobile navigation disclosure must be visible");
      assert.equal(await menu.getAttribute("aria-expanded"), "false");
      await menu.click();
      const expanded = page.getByRole("button", { name: "Close", exact: true });
      assert.equal(await expanded.getAttribute("aria-expanded"), "true");
      const items = page.getByRole("navigation", { name: "TITAN mobile navigation" }).getByRole("link");
      assert.equal(await items.count(), 4, "Mobile menu must keep all desktop destinations");
      for (const item of await items.all()) {
        assert.ok((await item.boundingBox()).height >= 44, "Mobile menu links need 44px targets");
      }
      await expanded.press("Escape");
      assert.equal(await menu.getAttribute("aria-expanded"), "false", "Escape must dismiss the menu");
      assert.equal(await menu.evaluate(node => document.activeElement === node), true, "Escape restores menu focus");
      await menu.click();
      // Use an unobstructed, noninteractive surface outside the menu.
      // Skip-link focus may scroll the heading under the site's header.
      await page.locator(".titanAnnouncement").click({ position: { x: 5, y: 5 } });
      assert.equal(await menu.getAttribute("aria-expanded"), "false", "Outside click must dismiss menu");
    } else {
      assert.equal(await menu.count(), 0, "Desktop must not show an unnecessary mobile menu button");
      assert.equal(await page.getByRole("navigation", { name: "TITAN navigation" }).isVisible(), true);
    }

    const routeLinks = await page.locator(".titan a[href]").evaluateAll(nodes =>
      nodes
        .map(node => node.getAttribute("href"))
        .filter(href => href && href.startsWith("/") && href !== "/")
        .map(href => new URL(href, window.location.origin).pathname)
    );
    assert.ok(routeLinks.length >= 10, "TITAN must link to functional customer routes");
    for (const href of routeLinks) {
      assert.ok(allowedPaths.has(href), `Unexpected customer route ${href}`);
    }
    const cta = page.getByRole("link", { name: /Design your outfit/i });
    // Check real keyboard focus, not programmatic pointer-modality focus:
    // :focus-visible is intentionally absent after pointer input.
    await cta.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await cta.evaluate(node => document.activeElement === node), true);
    assert.notEqual(await cta.evaluate(node => getComputedStyle(node).outlineStyle), "none");

    // Every visible navigation entry must be large enough to use on a phone,
    // tablet or desktop; screenshots alone cannot prove pointer ergonomics.
    const targets = await page.locator(".titanHeaderCta, .titanNav a, .titanMenuButton, .titanMobileNavPanel a, .titanOccasionLink, .titanButton, .titanTextLink, .titanFooter nav a, .titanFabricShowMore, .titanFabricCompareButton, .titanFabricComparisonClear, .titanFabricComparisonDetails a, .titanFabricOutfitSelect, .titanOutfitSlotText button, .titanOutfitBuildCta, .titanOutfitShareCta, .titanOutfitCopyButton, .titanOutfitShareInput, .titanLayerPlannerLibrary button, .titanLayerPlannerShareButton, .titanLayerPlannerShare input").evaluateAll(nodes =>
      nodes.filter(node => node.getClientRects().length > 0)
        .map(node => ({ text: node.textContent.trim().slice(0, 50), height: node.getBoundingClientRect().height }))
    );
    assert.ok(targets.length >= 8, "Expected maintained functional navigation controls");
    assert.deepEqual(targets.filter(target => target.height < 44), [], "Navigation target must be at least 44px high");

    // Enforce readable *computed* contrast, including small secondary copy.
    // Hardcoded CSS screenshots cannot detect all future low-contrast edits.
    const contrast = await page.evaluate(() => {
      const pairs = [
        [".titanHeroMeta", ".titanHeroCopy"],
        [".titanJourneys .titanSectionIntro > p", ".titanJourneys"],
        [".titanJourneyContent p", ".titanJourneyCard"],
        [".titanExperienceContent > p:not(.titanOverline)", ".titanExperience"],
        [".titanProcessList p", ".titanExperience"],
        [".titanExperienceStamp span", ".titanExperienceStamp"],
        [".titanTrack p", ".titanTrack"],
        [".titanTrackNumber", ".titanTrack"],
        [".titanFooterBrand span", ".titanFooter"],
        [".titanFooter > p", ".titanFooter"],
      ];
      const luminance = value => {
        const rgb = (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        if (rgb.length !== 3 || rgb.some(x => !Number.isFinite(x))) throw Error(`Invalid computed colour ${value}`);
        const channels = rgb.map(n => {
          const x = n / 255;
          return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      return pairs.map(([selector, background]) => {
        const element = document.querySelector(selector);
        const surface = document.querySelector(background);
        if (!element || !surface) throw Error(`Missing contrast target ${selector} / ${background}`);
        const fg = luminance(getComputedStyle(element).color);
        const bg = luminance(getComputedStyle(surface).backgroundColor);
        return { selector, ratio: Math.round((Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05) * 100) / 100 };
      });
    });
    assert.deepEqual(contrast.filter(entry => entry.ratio < 4.5), [], "Small text must meet WCAG AA 4.5:1 computed contrast");

    const broken = [];
    for (const img of await page.locator(".titan img").all()) {
      await img.scrollIntoViewIfNeeded();
      await img.evaluate(image => image.decode());
      if (!(await img.evaluate(image => image.naturalWidth > 0))) {
        broken.push(await img.getAttribute("src"));
      }
    }
    assert.deepEqual(broken, [], "All TITAN images must load");

    const widthInfo = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    assert.ok(widthInfo.document <= widthInfo.viewport + 2, `Horizontal overflow at ${width}px: ${JSON.stringify(widthInfo)}`);

    // Re-check after content has entered the viewport and after image decoding.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: path.join(out, `titan-${width}.png`), fullPage: true, animations: "disabled" });
    summary.viewports.push({ width, images: await page.locator(".titan img").count(), overflow: false, reducedMotion, minimumTarget: 44 });

    // Follow a real customer CTA to prove Next.js routing is functional;
    // checking href strings alone would not catch client navigation failures.

    if (width === 390 || width === 768) {
      // End-to-end cloth selection: keep the other saved garment untouched.
      // TITAN must not pretend the catalogue is physically stock-verified.
      await page.evaluate(() => localStorage.setItem("linen-earth:real-designer-draft:v2", JSON.stringify({
        shirtId: "linen-plain-60-peach",
        pantId: "linen-suiting-dark-grey",
        occasion: "Casual",
        climate: "Hot / humid",
        intention: "Balanced",
      })));
      const trouser = width === 768;
      if (trouser) await page.getByRole("button", { name: "Trouser cloth" }).click();
      const chosen = trouser ? "linen-suiting-orchid" : "linen-plain-60-sky-blue";
      const source = trouser ? "trouser" : "shirt";
      const link = page.locator(`.titanFabricCard[href="/designer-studio?source=titan&kind=${source}&fabric=${chosen}"]`);
      await link.scrollIntoViewIfNeeded();
      await link.click();
      await page.waitForURL(url => url.pathname === "/designer-studio" && url.searchParams.get("fabric") === chosen, { timeout: 15000 });
      await page.waitForFunction(({ expectedShirt, expectedPant }) =>
        document.querySelector("#designer-shirt")?.value === expectedShirt
        && document.querySelector("#designer-pant")?.value === expectedPant,
        {
          expectedShirt: trouser ? "linen-plain-60-peach" : chosen,
          expectedPant: trouser ? chosen : "linen-suiting-dark-grey",
        },
        { timeout: 15000 }
      );
      summary.handoffs.push({ source: "titan-fabric", kind: source, selected: chosen, savedCounterpartPreserved: true });
      await page.goto(`${base}/titan`, { waitUntil: "domcontentloaded" });
      await page.locator(".brandIntro").waitFor({ state: "hidden", timeout: 8000 });
      await waitForLocalReferences(page);
    }

    if (width === 390) {
      // Two-category selection survives tab switches and transfers both
      // explicit fabric IDs to the maintained Designer, never the whole draft.
      const shirt = "linen-plain-60-sky-blue";
      const trouser = "linen-suiting-beige";
      await page.locator(`.titanFabricTile:has(.titanFabricCard[href="/designer-studio?source=titan&kind=shirt&fabric=${shirt}"]) .titanFabricOutfitSelect`).click();
      assert.equal(await page.locator(".titanOutfitBuildCta").count(), 0);
      assert.equal(await page.locator(".titanPairingCard").count(), 3,
        "One real shirt must expose three catalogue-based trouser starting points");
      const existingDesignerDraft = await page.evaluate(() => localStorage.getItem("linen-earth:real-designer-draft:v2"));
      const suggestedTrouser = page.locator(".titanPairingCard").first();
      assert.match(await suggestedTrouser.textContent(), /Dark Grey/);
      assert.ok((await suggestedTrouser.locator("button").boundingBox()).height >= 44,
        "Pairing selection must be touch accessible");
      await suggestedTrouser.getByRole("button", { name: /Use Dark Grey with the chosen shirt reference/ }).click();
      assert.equal(await page.locator(".titanOutfitSlot img").count(), 2,
        "Choosing an editorial suggestion fills only the missing garment");
      assert.equal(await page.evaluate(() => localStorage.getItem("linen-earth:real-designer-draft:v2")),
        existingDesignerDraft, "Editorial suggestions cannot mutate the saved Designer draft");
      assert.equal(await page.locator(".titanOutfitBuildCta").getAttribute("href"),
        `/designer-studio?source=titan&shirt=${shirt}&trouser=linen-suiting-dark-grey`,
        "The manually chosen shirt must be preserved exactly");
      assert.equal(await page.locator(".titanPairingCard").count(), 0,
        "Do not offer overriding suggestions when an explicit pair is complete");
      await page.getByRole("button", { name: /Remove Dark Grey trouser from outfit/ }).click();
      assert.equal(await page.locator(".titanPairingCard").count(), 3,
        "Removing the suggested complementary cloth must restore opt-in choices");
      await page.getByRole("button", { name: "Trouser cloth" }).click();
      assert.equal(await page.locator(".titanOutfitSlot img").count(), 1, "Shirt choice must survive tab switch");
      // The default grid deliberately shows only eight references. Search for
      // the exact real trouser cloth instead of assuming it is on page one.
      await page.getByRole("searchbox", { name: "Find by colour or pattern" }).fill("beige");
      const matchingTrouser = page.locator(`.titanFabricTile:has(.titanFabricCard[href="/designer-studio?source=titan&kind=trouser&fabric=${trouser}"]) .titanFabricOutfitSelect`);
      assert.equal(await matchingTrouser.count(), 1, "Catalogue search must expose the chosen real trouser");
      await matchingTrouser.click();
      assert.equal(await page.locator(".titanOutfitSlot img").count(), 2);
      for (const img of await page.locator(".titanOutfitSlot img").all()) {
        await img.scrollIntoViewIfNeeded();
        await img.evaluate(node => node.decode());
        assert.ok(await img.evaluate(node => node.naturalWidth > 0));
      }
      const pairHref = `/designer-studio?source=titan&shirt=${shirt}&trouser=${trouser}`;
      assert.equal(await page.locator(".titanOutfitBuildCta").getAttribute("href"), pairHref);
      // A device-only bookmark is opt-in, reloadable, removable, and separate
      // from the maintained authenticated Designer draft and source model.
      const lookbookKey = "linen-earth:titan-reference-lookbook:v1";
      await waitForLocalReferences(page);
      assert.equal(await page.locator(".titanLookbookCard").count(), 0);
      const originalDraft = await page.evaluate(() => localStorage.getItem("linen-earth:real-designer-draft:v2"));
      const saveButton = page.getByRole("button", { name: "Save this pair on this device" });
      assert.ok((await saveButton.boundingBox()).height >= 44, "Local save must have a phone-friendly target");
      await saveButton.click();
      assert.equal(await page.locator(".titanLookbookCard").count(), 1);
      assert.equal(await page.getByRole("button", { name: "Saved on this device" }).isDisabled(), true);
      assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), lookbookKey),
        { version: 1, pairs: [{ shirtId: shirt, trouserId: trouser }] });
      assert.equal(await page.evaluate(() => localStorage.getItem("linen-earth:real-designer-draft:v2")),
        originalDraft, "Saving a public cloth reference must not write the customer Designer draft");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator(".brandIntro").waitFor({ state: "hidden", timeout: 8000 });
      await waitForLocalReferences(page);
      assert.equal(await page.locator(".titanLookbookCard").count(), 1, "Local reference should survive browser reload");
      assert.equal(await page.locator(".titanOutfitSlot img").count(), 0,
        "Reload must not silently load bookmarked cloths into the current selection");
      await page.locator(".titanLookbookCardActions button").first().click();
      assert.equal(await page.locator(".titanOutfitBuildCta").getAttribute("href"), pairHref,
        "Explicit reopen must restore exactly the stored public reference IDs");
      assert.equal(await page.locator(".titanLookbookCardActions button").first().boundingBox().then(b => b.height >= 44), true);
      await page.locator(".titanLookbookCardActions button").last().click();
      assert.equal(await page.locator(".titanLookbookCard").count(), 0);
      assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).pairs, lookbookKey), []);
      assert.equal(await page.locator(".titanOutfitBuildCta").getAttribute("href"), pairHref,
        "Removing a bookmark must not silently change the live outfit");
      summary.handoffs.push({ source: "titan-device-lookbook", saved: true,
        persistedAcrossReload: true, removed: true, designerDraftPreserved: true });
      // Reopen a shared outfit in a fresh page load. A link contains only two
      // real swatch IDs, never the customer's stored Designer measurements.
      const shareHref = `/titan?source=outfit&shirt=${shirt}&trouser=${trouser}#titan-outfit-builder`;
      assert.equal(await page.locator(".titanOutfitShareCta").getAttribute("href"), shareHref);
      const absoluteShare = new URL(shareHref, base).href;
      await page.waitForFunction(expected => document.querySelector(".titanOutfitShareInput")?.value === expected,
        absoluteShare, { timeout: 10000 });
      const shareInput = page.getByRole("textbox", { name: "Shareable outfit reference link" });
      await shareInput.focus();
      assert.equal(await shareInput.evaluate(node => node.selectionEnd - node.selectionStart),
        absoluteShare.length, "Focused link must be selectable when clipboard is unavailable");
      await page.getByRole("button", { name: "Copy link" }).click();
      assert.match(await page.locator(".titanOutfitCopyStatus").textContent(),
        /Cloth-pair link copied|Copy the link from the field/,
        "Clipboard success or an explicit manual fallback is required");
      // Simulate denied clipboard permission, not merely an absent clipboard.
      // The exact absolute link must become selected for manual copying.
      await page.evaluate(() => Object.defineProperty(navigator, "clipboard", {
        configurable: true, value: { writeText: async () => { throw Error("Clipboard permission denied"); } },
      }));
      await page.getByRole("button", { name: "Copy link" }).click();
      await page.waitForFunction(() =>
        document.querySelector(".titanOutfitCopyStatus")?.textContent?.includes("Copy the link from the field above"),
        null, { timeout: 10000 });
      assert.match(await page.locator(".titanOutfitCopyStatus").textContent(),
        /Copy the link from the field above/,
        "Denied clipboard writes must expose a usable manual fallback");
      assert.equal(await shareInput.evaluate(node => node.selectionEnd - node.selectionStart),
        absoluteShare.length, "Clipboard fallback must select the full current URL");

      // A same-path shared link must be a real navigation: Next's default
      // soft navigation would retain an unrelated comparison and search state
      // instead of rehydrating from the exact public reference link.
      await page.locator(".titanFabricCompareButton").first().click();
      assert.equal(await page.locator(".titanFabricComparisonItem").count(), 1);
      await page.locator(".titanOutfitShareCta").click();
      await page.waitForURL(url => url.pathname === "/titan" && url.searchParams.get("source") === "outfit", { timeout: 15000 });
      await page.waitForFunction(() => document.querySelectorAll(".titanOutfitSlot img").length === 2, null, { timeout: 15000 });
      assert.equal(await page.locator(".titanFabricComparisonItem").count(), 0,
        "Opening a same-route share link must not retain a private comparison shortlist");
      assert.equal(await page.getByRole("searchbox", { name: "Find by colour or pattern" }).inputValue(), "",
        "Share links must open a fresh catalogue, not leaked local search state");
      assert.equal(await page.locator(".titanOutfitBuildCta").getAttribute("href"), pairHref);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.querySelectorAll(".titanOutfitSlot img").length === 2, null, { timeout: 15000 });
      assert.equal(await page.locator(".titanOutfitBuildCta").getAttribute("href"), pairHref,
        "A reopened share link must restore the original exact shirt and trouser pair");
      await page.goto(`${base}/titan?source=outfit&shirt=${trouser}&trouser=${shirt}`, { waitUntil: "domcontentloaded" });
      await page.locator(".brandIntro").waitFor({ state: "hidden", timeout: 8000 });
      await waitForLocalReferences(page);
      assert.equal(await page.locator(".titanOutfitSlot img").count(), 0,
        "Swapped garment IDs must not prefill a customer outfit");
      await page.goto(`${base}${shareHref}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.querySelectorAll(".titanOutfitSlot img").length === 2, null, { timeout: 15000 });
      summary.handoffs.push({ source: "titan-shared-reference-pair", shirt, trouser,
        reloaded: true, crossGarmentRejected: true });
      await page.evaluate(() => localStorage.setItem("linen-earth:real-designer-draft:v2", JSON.stringify({
        shirtId: "linen-plain-60-peach", pantId: "linen-suiting-dark-grey",
        occasion: "Casual", climate: "Hot / humid", intention: "Balanced",
      })));
      await page.locator(".titanOutfitBuildCta").click();
      await page.waitForURL(url => url.pathname === "/designer-studio" && url.searchParams.get("shirt") === shirt && url.searchParams.get("trouser") === trouser, { timeout: 15000 });
      await page.waitForFunction(({ shirt, trouser }) =>
        document.querySelector("#designer-shirt")?.value === shirt
        && document.querySelector("#designer-pant")?.value === trouser,
        { shirt, trouser }, { timeout: 15000 });
      assert.equal(await page.locator('input[name="designerOccasion"][value="Casual"]').isChecked(), true,
        "Outfit transfer cannot override saved occasion");
      assert.equal(await page.getByLabel("Style mood").inputValue(), "Balanced", "Style mood remains saved");
      assert.equal(await page.getByLabel("Climate").inputValue(), "Hot / humid", "Climate remains saved");
      summary.handoffs.push({ source: "titan-outfit-pair", shirt, trouser, explicitBoth: true,
        existingOccasionAndPreferencesPreserved: true });
      await page.goto(`${base}/titan`, { waitUntil: "domcontentloaded" });
      await page.locator(".brandIntro").waitFor({ state: "hidden", timeout: 8000 });
      await waitForLocalReferences(page);
    }

    if (width === 320) {
      // Reverse pairing direction on a real narrow phone viewport.
      await page.getByRole("button", { name: "Trouser cloth" }).click();
      await page.locator(".titanFabricOutfitSelect").first().click();
      const chosenTrouser = await page.locator(".titanOutfitSlot").nth(1).locator(".titanOutfitSlotText p").textContent();
      assert.equal(await page.locator(".titanPairingCard").count(), 3,
        "A chosen trouser needs three real, distinct shirting alternatives");
      await page.locator(".titanPairingCardCopy button").first().click();
      assert.equal(await page.locator(".titanOutfitSlot img").count(), 2);
      assert.equal(await page.locator(".titanOutfitSlot").nth(1).locator(".titanOutfitSlotText p").textContent(),
        chosenTrouser, "Suggested shirt must preserve the chosen trouser");
      assert.equal(await page.locator(".titanPairingCard").count(), 0);
      summary.handoffs.push({ source: "titan-editorial-pairings", viewport: width,
        reverseGarmentAnchorPreserved: true, physicalClaims: false });
      // Manually tampered browser storage must not inject catalogue selections
      // or quietly copy personal fields into a public reference lookbook.
      await page.evaluate(() => localStorage.setItem("linen-earth:titan-reference-lookbook:v1", JSON.stringify({
        version: 1, pairs: [{
          shirtId: "linen-plain-60-sky-blue", trouserId: "linen-suiting-beige",
          measurement: "never-store-personal-measurements",
        }],
      })));
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator(".brandIntro").waitFor({ state: "hidden", timeout: 8000 });
      await waitForLocalReferences(page);
      assert.equal(await page.locator(".titanLookbookCard").count(), 0,
        "Unknown personal fields in saved-reference storage must fail closed");
      assert.equal(await page.locator(".titanOutfitSlot img").count(), 0,
        "Tampered browser storage must never silently fill the garment slots");
      summary.handoffs.push({ source: "titan-device-lookbook", viewport: width,
        tamperedStorageRejected: true, automaticDesignerMutation: false });
    }

    const destination = width === 320 ? "/measurements" : width === 390 ? "/designer-studio" : width === 768 ? "/style-director" : "/account";
    if (width === 320) {
      await menu.click();
      await page.locator('.titanMobileNavPanel a[href="/measurements"]').click();
    } else {
      const link = width === 390 ? page.getByRole("link", { name: /Design your outfit/i })
        : width === 768 ? page.getByRole("link", { name: /Explore style direction/i })
        : page.locator('.titanNav a[href="/account"]');
      await link.click();
    }
    await page.waitForURL(url => url.pathname === destination, { timeout: 15000 });
    assert.equal(new URL(page.url()).pathname, destination);
    summary.navigations.push({ width, destination, passed: true });
    if (width === 390) {
      // Verify real cross-route state, not just a well-formed URL: Work is
      // prefilled once, the remaining five questions still run, and Start over
      // actually returns to the untouched first question.
      await page.goto(`${base}/titan`, { waitUntil: "domcontentloaded" });
      await page.locator(".brandIntro").waitFor({ state: "hidden", timeout: 8000 });
      await waitForLocalReferences(page);
      await page.locator('.titanOccasionLink[href*="occasion=Work"]').click();
      await page.waitForURL(url => url.pathname === "/style-director" && url.searchParams.get("occasion") === "Work", { timeout: 15000 });
      await page.getByRole("heading", { name: "How should you feel in it?" }).waitFor({ timeout: 15000 });
      await page.getByRole("button", { name: /Start over/i }).click();
      await page.getByRole("heading", { name: /No forms/i }).waitFor({ timeout: 15000 });
      assert.equal(new URL(page.url()).searchParams.has("occasion"), false, "Start over must clear prefill query");
      summary.handoffs.push({ occasion: "Work", prefilled: true, reset: true });
    }
  } catch (error) {
    await page.screenshot({ path: path.join(out, `titan-failure-${width}.png`), fullPage: true, animations: "disabled" }).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

async function main() {
  await fs.mkdir(out, { recursive: true });
  browser = await chromium.launch({ headless: true });
  try {
    for (const width of widths) await checkViewport(width);
    assert.deepEqual(summary.providerCalls, [], "Browsing TITAN cannot trigger paid AI endpoints");
    assert.deepEqual(summary.consoleErrors, [], "TITAN cannot produce unhandled client errors");
    await fs.writeFile(path.join(out, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
    process.stdout.write(JSON.stringify(summary) + "\n");
  } finally {
    await browser.close();
  }
}
main().catch(async error => {
  const detail = error.stack || String(error);
  summary.failure = detail;
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(out, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  process.stderr.write(`TITAN smoke failed: ${detail}\n`);
  process.exitCode = 1;
});
