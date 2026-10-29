/** A truncated operator event history can hide an older sold-out veto.
 * PostgREST must return an exact count and every row for this bounded read.
 * Until a paginated reader exists, oversized histories fail closed.
 */
export const OPERATOR_METADATA_PAGE_LIMIT = 1000;

export function hasCompleteOperatorMetadataPage(rows: unknown, contentRange: string | null): rows is unknown[] {
  if (!Array.isArray(rows) || rows.length > OPERATOR_METADATA_PAGE_LIMIT) return false;
  if (rows.length === 0) return contentRange === "*/0";
  if (!contentRange) return false;
  const match = /^(\d+)-(\d+)\/(\d+)$/.exec(contentRange);
  if (!match) return false;
  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);
  return [start, end, total].every(Number.isSafeInteger)
    && start === 0 && end === rows.length - 1 && total === rows.length;
}
