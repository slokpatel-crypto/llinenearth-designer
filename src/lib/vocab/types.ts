export type VocabEntry<Id extends string=string> = {
  id:Id;
  label:string;
  aliases:readonly string[];
};

export type VocabId<V extends readonly VocabEntry[]> = V[number]["id"];
