// Test-only loader for the existing TS/JSON engine; no application dependency.
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module"), ts = require("typescript");
const modules = new Map();
function load(file) {
  const full = path.resolve(file);
  if (modules.has(full)) return modules.get(full).exports;
  if (full.endsWith(".json")) return JSON.parse(fs.readFileSync(full, "utf8"));
  const loaded = new Module(full); loaded.filename = full; loaded.paths = Module._nodeModulePaths(path.dirname(full)); modules.set(full, loaded);
  const nativeRequire = loaded.require.bind(loaded);
  loaded.require = (specifier) => {
    const target = specifier.startsWith("@/") ? path.resolve("src", specifier.slice(2)) : specifier.startsWith(".") ? path.resolve(path.dirname(full), specifier) : null;
    if (target) for (const candidate of [target, target + ".ts", path.join(target, "index.ts")]) if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return load(candidate);
    return nativeRequire(specifier);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(full, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, full);
  return loaded.exports;
}
module.exports = { load };
