import test from "node:test";
import assert from "node:assert/strict";
import { removeSavedDesign, SAVED_DESIGNS_KEY } from "../src/lib/saved-designs.ts";

function withStore(raw: string | null, run: (storage: Map<string,string>) => void) {
  const storage = new Map<string,string>();
  if (raw !== null) storage.set(SAVED_DESIGNS_KEY, raw);
  const previous = (globalThis as {window?: unknown}).window;
  (globalThis as {window?: unknown}).window = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key,value); },
    },
  };
  try { run(storage); }
  finally {
    if (previous === undefined) delete (globalThis as {window?: unknown}).window;
    else (globalThis as {window?: unknown}).window = previous;
  }
}

test("deleting a design preserves malformed and non-array legacy data", () => {
  for (const raw of ["{bad", '{"old":"format"}', "null"]) {
    withStore(raw, (storage) => {
      assert.throws(() => removeSavedDesign("SD-target"), /preserved/);
      assert.equal(storage.get(SAVED_DESIGNS_KEY), raw);
    });
  }
});

test("deleting one design preserves unknown legacy entries and other designs", () => {
  const legacy = {id:"legacy-unknown", unusualField:{recoverable:true}};
  const target = {id:"SD-target", title:"Remove me"};
  const survivor = {id:"SD-keep", title:"Keep me"};
  withStore(JSON.stringify([legacy, target, null, survivor, "unrecognized"]), (storage) => {
    removeSavedDesign("SD-target");
    assert.deepEqual(JSON.parse(storage.get(SAVED_DESIGNS_KEY)!), [legacy,null,survivor,"unrecognized"]);
  });
});

test("deleting an absent design does not rewrite existing storage", () => {
  const raw = '[ {"id":"SD-keep","unrecognized":true} ]';
  withStore(raw, (storage) => {
    removeSavedDesign("SD-absent");
    assert.equal(storage.get(SAVED_DESIGNS_KEY), raw);
  });
});
