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
    await page.getByRole("heading", { name: /Considered cloth/i }).waitFor();

    assert.equal(await page.title(), "The Linen Earth Studio | TITAN");
    assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow", "pilot must not be indexed");
    assert.equal(await page.locator(".titanJourneyCard").count(), 3);
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
    const targets = await page.locator(".titanHeaderCta, .titanNav a, .titanMenuButton, .titanMobileNavPanel a, .titanOccasionLink, .titanButton, .titanTextLink, .titanFooter nav a, .titanFabricCompareButton, .titanFabricComparisonClear, .titanFabricComparisonDetails a, .titanFabricOutfitSelect, .titanOutfitSlotText button, .titanOutfitBuildCta").evaluateAll(nodes =>
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
    }

    if (width === 390) {
      // Two-category selection survives tab switches and transfers both
      // explicit fabric IDs to the maintained Designer, never the whole draft.
      const shirt = "linen-plain-60-sky-blue";
      const trouser = "linen-suiting-beige";
      await page.locator(`.titanFabricTile:has(.titanFabricCard[href="/designer-studio?source=titan&kind=shirt&fabric=${shirt}"]) .titanFabricOutfitSelect`).click();
      assert.equal(await page.locator(".titanOutfitBuildCta").count(), 0);
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
