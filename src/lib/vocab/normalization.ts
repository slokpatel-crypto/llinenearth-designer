import type { VocabEntry, VocabId } from "./types.ts";

export type NormalizeResult<Id extends string> = {
  value:Id|null;
  reviewNeeded:string[];
};

export function normalizeVocabText(value:string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g," and ")
    .replace(/[^a-z0-9]+/g," ")
    .trim()
    .replace(/\s+/g," ");
}

export function normalizeToken<V extends readonly VocabEntry[]>(
  free:unknown,
  vocab:V,
):NormalizeResult<VocabId<V>> {
  const raw=String(free??"").trim();
  if(!raw) return {value:null,reviewNeeded:[]};
  const exact=vocab.find((entry)=>entry.id===raw);
  if(exact) return {value:exact.id as VocabId<V>,reviewNeeded:[]};

  const normalized=normalizeVocabText(raw);
  const alias=vocab.find((entry)=>entry.aliases.some((item)=>normalizeVocabText(item)===normalized));
  if(alias) return {value:alias.id as VocabId<V>,reviewNeeded:[]};

  const label=vocab.find((entry)=>normalizeVocabText(entry.label)===normalized);
  if(label) return {value:label.id as VocabId<V>,reviewNeeded:[]};

  return {value:null,reviewNeeded:[raw]};
}

export function normalizeArray<V extends readonly VocabEntry[]>(
  values:unknown,
  vocab:V,
):{values:VocabId<V>[];reviewNeeded:string[]} {
  const input=Array.isArray(values)?values:[];
  const output:VocabId<V>[]=[];
  const reviewNeeded:string[]=[];
  for(const item of input) {
    const normalized=normalizeToken(item,vocab);
    if(normalized.value && !output.includes(normalized.value)) output.push(normalized.value);
    reviewNeeded.push(...normalized.reviewNeeded);
  }
  return {values:output,reviewNeeded:[...new Set(reviewNeeded)]};
}
