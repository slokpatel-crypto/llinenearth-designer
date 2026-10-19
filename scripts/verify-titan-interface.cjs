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
const widths = [390, 768, 1440];
const allowedPaths = new Set(["/designer-studio", "/style-director", "/measurements", "/account"]);
const summary = { route: "/titan", status: "pilot", viewports: [], navigations: [], providerCalls: [], consoleErrors: [] };
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

    // Real keyboard skip behaviour, not just a decorative anchor.
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await skip.focus();
    assert.notEqual(await skip.evaluate(node => getComputedStyle(node).outlineStyle), "none");
    await skip.press("Enter");
    assert.equal(await page.locator("#titan-main").evaluate(node => document.activeElement === node), true, "Skip must move keyboard focus into main");

    const routeLinks = await page.locator(".titan a[href]").evaluateAll(nodes =>
      nodes
        .map(node => node.getAttribute("href"))
        .filter(href => href && href.startsWith("/") && href !== "/")
    );
    assert.ok(routeLinks.length >= 10, "TITAN must link to functional customer routes");
    for (const href of routeLinks) {
      assert.ok(allowedPaths.has(href), `Unexpected customer route ${href}`);
    }
    const cta = page.getByRole("link", { name: /Design your outfit/i });
    await cta.focus();
    assert.equal(await cta.evaluate(node => document.activeElement === node), true);
    assert.notEqual(await cta.evaluate(node => getComputedStyle(node).outlineStyle), "none");

    // Every visible navigation entry must be large enough to use on a phone,
    // tablet or desktop; screenshots alone cannot prove pointer ergonomics.
    const targets = await page.locator(".titanHeaderCta, .titanNav a, .titanButton, .titanTextLink, .titanFooter nav a").evaluateAll(nodes =>
      nodes.map(node => ({ text: node.textContent.trim().slice(0, 50), height: node.getBoundingClientRect().height }))
    );
    assert.ok(targets.length >= 10, "Expected maintained functional navigation controls");
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
        const rgb = (value.match(/[\\d.]+/g) || []).slice(0, 3).map(Number);
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
    const destination = width === 390 ? "/designer-studio" : width === 768 ? "/style-director" : "/account";
    const link = width === 390 ? page.getByRole("link", { name: /Design your outfit/i })
      : width === 768 ? page.getByRole("link", { name: /Explore style direction/i })
      : page.locator('.titanNav a[href="/account"]');
    await link.click();
    await page.waitForURL(url => url.pathname === destination, { timeout: 15000 });
    assert.equal(new URL(page.url()).pathname, destination);
    summary.navigations.push({ width, destination, passed: true });
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
