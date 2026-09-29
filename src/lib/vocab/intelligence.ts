import type { ColorFamilyId } from "./colors.ts";

export function colorFamilyPairSignal(
  good:readonly ColorFamilyId[],
  avoid:readonly ColorFamilyId[],
  target:ColorFamilyId|null|undefined,
) {
  if(!target) return 0;
  if(avoid.includes(target)) return -1;
  if(good.includes(target)) return 1;
  return 0;
}
