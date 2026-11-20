// Test-only bridge for Next.js "@/" source aliases in bare Node 22 tests.
// Never used by the customer app or production rendering path.
import { access, readFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const srcRoot = resolvePath(process.cwd(), "src");

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) return nextResolve(specifier, context);

  const relative = specifier.slice(2);
  const base = resolvePath(srcRoot, relative);
  if (!base.startsWith(srcRoot + "/")) {
    throw new Error("Style Director test loader rejected a path outside src");
  }
  for (const suffix of [".ts", ".tsx", ".mjs", ".json", "/index.ts"]) {
    const candidate = base + suffix;
    try {
      await access(candidate);
      return nextResolve(pathToFileURL(candidate).href, context);
    } catch (error) {
      if (error && error.code !== "ENOENT") throw error;
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  // Some existing engine JSON imports have no import attribute. Node 22's
  // built-in loader requires one, while Next's bundler already handles them.
  // Adapt only test-time JSON and preserve the exact decoded JSON value.
  if (url.startsWith("file:") && url.endsWith(".json")) {
    const parsed = JSON.parse(await readFile(fileURLToPath(url), "utf8"));
    return { format: "module", source: "export default " + JSON.stringify(parsed) + ";", shortCircuit: true };
  }
  return nextLoad(url, context);
}
