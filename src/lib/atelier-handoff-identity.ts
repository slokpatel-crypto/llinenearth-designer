/**
 * A specification hash identifies *cloth and construction*, not the saved
 * design or customer. Two different designs can share that exact spec while
 * requiring independent consultations and notes.
 */
export function mergeDistinctAtelierHandoffs<T extends {designId:string;specHash:string}>(
  previous:readonly T[],
  next:T,
  limit=50,
):T[] {
  return [
    next,
    ...previous.filter((item)=>item.designId!==next.designId || item.specHash!==next.specHash),
  ].slice(0,limit);
}
