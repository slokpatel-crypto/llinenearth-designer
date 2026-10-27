export type BrowserRecordStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type BrowserWriteResult = { saved: boolean; rollbackComplete: boolean };

/** Best-effort multi-record write, not a transaction or cross-tab lock. */
export function writeBrowserRecords(
  storage: BrowserRecordStore,
  records: ReadonlyArray<readonly [string, string | null]>,
): BrowserWriteResult {
  if (new Set(records.map(([key]) => key)).size !== records.length) {
    throw new Error("Duplicate browser storage keys.");
  }
  let previous: Array<string | null>;
  try {
    previous = records.map(([key]) => storage.getItem(key));
  } catch {
    return { saved: false, rollbackComplete: true };
  }
  let attempted = 0;
  try {
    for (const [key, value] of records) {
      attempted++;
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    }
    if (!records.every(([key, value]) => storage.getItem(key) === value)) {
      throw new Error("Browser records changed before confirmation.");
    }
    return { saved: true, rollbackComplete: true };
  } catch {
    let rollbackComplete = true;
    for (let i = attempted - 1; i >= 0; i--) {
      const [key, value] = records[i];
      try {
        const current = storage.getItem(key);
        if (current === previous[i]) continue;
        if (current !== value) { rollbackComplete = false; continue; }
        if (previous[i] === null) storage.removeItem(key);
        else storage.setItem(key, previous[i]!);
        if (storage.getItem(key) !== previous[i]) rollbackComplete = false;
      } catch {
        rollbackComplete = false;
      }
    }
    return { saved: false, rollbackComplete };
  }
}
