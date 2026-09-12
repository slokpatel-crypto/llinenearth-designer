import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.DEMO_BASE_URL || "http://127.0.0.1:3000";
const out = path.resolve("demo-output");
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(path.join(out, "video"), { recursive: true });

const fabricPath = path.join(out, "demo-linen.svg");
fs.writeFileSync(fabricPath, `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><defs><filter id="n"><feTurbulence baseFrequency=".035" numOctaves="4" seed="8"/><feBlend mode="multiply" in2="SourceGraphic"/></filter><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d8c7aa"/><stop offset="1" stop-color="#a99575"/></linearGradient></defs><rect width="1200" height="900" fill="url(#g)"/><rect x="70" y="70" width="1060" height="760" rx="24" fill="#d5c5a8" filter="url(#n)" opacity=".72"/><path d="M0 650 C260 560 490 790 1200 610 L1200 900 L0 900Z" fill="#927f61" opacity=".26"/></svg>`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: path.join(out, "video"), size: { width: 1440, height: 900 } } });
const page = await context.newPage();
const video = page.video();

async function snap(name, fullPage = false) {
  await page.screenshot({ path: path.join(out, name), fullPage });
  await page.waitForTimeout(700);
}

async function choose(text) {
  const button = page.locator(".choiceGrid button").filter({ hasText: text }).first();
  await button.waitFor();
  await button.click();
  await page.waitForTimeout(250);
}

await page.goto(base, { waitUntil: "networkidle" });
await page.waitForTimeout(4300);
await snap("01-home.png", true);

await page.getByRole("link", { name: /start designing/i }).first().click();
await page.getByRole("heading", { name: "Start with the cloth." }).waitFor();
await snap("02-designer-upload.png", true);

await page.locator('input[type="file"]').setInputFiles(fabricPath);
await page.getByRole("button", { name: /analyze fabric/i }).click();
await page.getByRole("heading", { name: "What we can see" }).waitFor();
const materialLabel = page.locator("label").filter({ hasText: "Material family" });
await materialLabel.locator("select").selectOption({ label: "Linen" });
await snap("03-fabric-analysis.png", true);

await page.getByRole("button", { name: /judge this fabric for my occasion/i }).click();
for (const option of ["Wedding","Luxury hotel","Evening","Mostly indoor","Refined","Quiet confidence","Tailored","Modern Classic"]) await choose(option);

await page.getByRole("heading", { name: "Three ways forward." }).waitFor({ timeout: 15000 });
await snap("04-designer-directions.png", true);

await page.getByRole("button", { name: /compare & refine/i }).click();
await page.getByRole("heading", { name: "Keep what works. Change only what should." }).waitFor();
await snap("05-refinement.png", true);

await page.getByRole("button", { name: "More Italian", exact: true }).click();
await page.waitForTimeout(1400);
await page.getByRole("button", { name: /lock this design/i }).click();
await page.getByRole("button", { name: /visualize locked design/i }).waitFor();
await snap("06-locked-version.png", true);

await page.getByRole("button", { name: /visualize locked design/i }).click();
await page.getByRole("heading", { name: "Your design, resolved into one presentation." }).waitFor({ timeout: 15000 });
await snap("07-visualization.png", true);

await page.getByRole("button", { name: "Save this design", exact: true }).click();
await page.getByRole("button", { name: "Saved to your atelier", exact: true }).waitFor();
await page.getByRole("link", { name: /view saved designs/i }).click();
await page.getByRole("heading", { name: "Ideas worth returning to." }).waitFor();
await snap("08-saved-designs.png", true);

await page.getByRole("button", { name: /send to llinen earth atelier/i }).click();
await page.getByText("REQUEST CREATED", { exact: true }).waitFor();
await snap("09-handoff-created.png", true);
await page.getByRole("link", { name: /open atelier queue/i }).click();
await page.waitForTimeout(900);
await snap("10-atelier-queue.png", true);

await page.getByRole("link", { name: "Fashion Brain", exact: true }).click();
await page.waitForTimeout(800);
await snap("11-fashion-brain.png", true);

await page.getByRole("link", { name: "Quality", exact: true }).click();
await page.waitForTimeout(800);
await snap("12-quality-lab.png", true);

await context.close();
if (video) {
  const source = await video.path();
  fs.copyFileSync(source, path.join(out, "actual-working-demo.webm"));
}
await browser.close();
console.log("Actual website demo captured successfully.");
