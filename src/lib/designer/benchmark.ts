export const DESIGNER_BENCHMARK_VERSION="designer-benchmark-v1" as const;

export type DesignerBenchmarkCase = {
  id:string;
  index:number;
  occasion:"Casual"|"Smart-Casual"|"Semi-Formal"|"Formal";
  climate:"Not specified"|"Hot / humid"|"Cool"|"Air-conditioned";
  intention:"Understated"|"Balanced"|"Expressive";
  anchorShirtId:string;
  anchorPantId:string;
};

const OCCASIONS:DesignerBenchmarkCase["occasion"][]=["Casual","Smart-Casual","Semi-Formal","Formal"];
const CLIMATES:DesignerBenchmarkCase["climate"][]=["Not specified","Hot / humid","Cool","Air-conditioned"];
const INTENTIONS:DesignerBenchmarkCase["intention"][]=["Understated","Balanced","Expressive"];

export function buildDesignerBenchmarkCases(
  shirts:Array<{id:string}>,
  pants:Array<{id:string}>,
):DesignerBenchmarkCase[] {
  const shirtIds=[...new Set(shirts.map((item)=>item.id).filter(Boolean))].sort();
  const pantIds=[...new Set(pants.map((item)=>item.id).filter(Boolean))].sort();
  if(!shirtIds.length || !pantIds.length) return [];

  const cases:DesignerBenchmarkCase[]=[];
  let index=0;
  for(let intentionIndex=0;intentionIndex<INTENTIONS.length;intentionIndex++) {
    for(let climateIndex=0;climateIndex<CLIMATES.length;climateIndex++) {
      for(let occasionIndex=0;occasionIndex<OCCASIONS.length;occasionIndex++) {
        // Co-prime stepping spreads the 48 cases across the catalogue instead
        // of repeatedly benchmarking the same first few stock records.
        const shirtIndex=(index*7 + occasionIndex*3 + intentionIndex) % shirtIds.length;
        const pantIndex=(index*5 + climateIndex*2 + intentionIndex*3) % pantIds.length;
        cases.push({
          id:`benchmark-${String(index+1).padStart(2,"0")}`,
          index,
          occasion:OCCASIONS[occasionIndex],
          climate:CLIMATES[climateIndex],
          intention:INTENTIONS[intentionIndex],
          anchorShirtId:shirtIds[shirtIndex],
          anchorPantId:pantIds[pantIndex],
        });
        index+=1;
      }
    }
  }
  return cases;
}
