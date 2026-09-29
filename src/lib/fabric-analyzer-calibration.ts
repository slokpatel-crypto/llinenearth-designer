import "server-only";
import type { FabricAnalyzerProfile } from "@/lib/fabric-analyzer";
import {
  loadFabricAnalyzerCalibrationCases,
  recordFabricAnalyzerCalibration,
  type FabricAnalyzerCalibrationCase,
} from "@/lib/fabric-analyzer-store";
import { analyzeMenswearReferencePage } from "@/lib/fabric-analyzer";

type CalibrationResult = {
  caseId:string;
  sourceId:string;
  score:number;
  checks:Array<{name:string;pass:boolean;weight:number;detail:string}>;
  profileId:string|null;
  cached:boolean;
};

function tokens(value:unknown) {
  return Array.isArray(value) ? value.map((item)=>String(item).toLowerCase().trim()).filter(Boolean) : [];
}

function containsAny(values:string[],expected:string[]) {
  const hay=values.join(" ").toLowerCase();
  return expected.some((token)=>hay.includes(token.toLowerCase()));
}

function checkProfile(profile:FabricAnalyzerProfile,test:FabricAnalyzerCalibrationCase) {
  const expected=test.expected || {};
  const checks:Array<{name:string;pass:boolean;weight:number;detail:string}>=[];

  const materialTerms=tokens(expected.materialTerms);
  if(materialTerms.length) {
    const actual=profile.references.materialTerms.map((value)=>value.toLowerCase());
    checks.push({
      name:"material/construction vocabulary",
      pass:containsAny(actual,materialTerms),
      weight:25,
      detail:`expected any of ${materialTerms.join(", ")}; got ${actual.join(", ") || "none"}`,
    });
  }

  const patternTokens=tokens(expected.patternTokens);
  const patternFamily=tokens(expected.patternFamily);
  if(patternTokens.length || patternFamily.length) {
    const actual=[
      profile.observed.patternFamily,
      ...profile.references.patternTerms,
      ...profile.observed.weaveAppearance,
    ].map((value)=>String(value).toLowerCase());
    checks.push({
      name:"pattern/construction",
      pass:containsAny(actual,[...patternTokens,...patternFamily]),
      weight:20,
      detail:`expected any of ${[...patternTokens,...patternFamily].join(", ")}; got ${actual.join(", ") || "none"}`,
    });
  }

  const colorTokens=tokens(expected.colorTokens);
  if(colorTokens.length) {
    const actual=[
      profile.observed.dominantColor,
      profile.observed.colorFamily,
      ...profile.references.colorTerms,
    ].map((value)=>String(value).toLowerCase());
    checks.push({
      name:"color family",
      pass:containsAny(actual,colorTokens),
      weight:15,
      detail:`expected any of ${colorTokens.join(", ")}; got ${actual.join(", ") || "none"}`,
    });
  }

  const garmentTokens=tokens(expected.bestGarmentTokens);
  if(garmentTokens.length) {
    const actual=profile.inferredStyle.bestGarments.map((value)=>value.toLowerCase());
    checks.push({
      name:"menswear use",
      pass:containsAny(actual,garmentTokens),
      weight:20,
      detail:`expected any of ${garmentTokens.join(", ")}; got ${actual.join(", ") || "none"}`,
    });
  }

  const range=Array.isArray(expected.formalityRange) ? expected.formalityRange.map(Number) : [];
  if(range.length===2 && range.every(Number.isFinite)) {
    const pass=profile.inferredStyle.formality>=Math.min(range[0],range[1])
      && profile.inferredStyle.formality<=Math.max(range[0],range[1]);
    checks.push({
      name:"formality range",
      pass,
      weight:20,
      detail:`expected ${Math.min(range[0],range[1])}-${Math.max(range[0],range[1])}; got ${profile.inferredStyle.formality}`,
    });
  }

  const total=checks.reduce((sum,item)=>sum+item.weight,0) || 1;
  const earned=checks.reduce((sum,item)=>sum+(item.pass?item.weight:0),0);
  return {
    score:Math.round(earned/total*1000)/10,
    checks,
  };
}

export async function runFabricAnalyzerCalibration(limit=4):Promise<{
  requested:number;
  completed:number;
  averageScore:number;
  results:CalibrationResult[];
}> {
  const cases=await loadFabricAnalyzerCalibrationCases(Math.max(1,Math.min(8,limit)));
  const results:CalibrationResult[]=[];

  for(const test of cases) {
    try {
      const analyzed=await analyzeMenswearReferencePage(test.source_url,{persist:true});
      const evaluated=checkProfile(analyzed.run.profile,test);
      await recordFabricAnalyzerCalibration({
        caseId:test.id,
        profileId:analyzed.run.profileId,
        score:evaluated.score,
        result:{checks:evaluated.checks,summary:analyzed.run.profile.summary},
      });
      results.push({
        caseId:test.id,
        sourceId:test.source_id,
        score:evaluated.score,
        checks:evaluated.checks,
        profileId:analyzed.run.profileId,
        cached:analyzed.run.cached,
      });
    } catch(error) {
      results.push({
        caseId:test.id,
        sourceId:test.source_id,
        score:0,
        checks:[{name:"analysis",pass:false,weight:100,detail:error instanceof Error?error.message:"Calibration failed."}],
        profileId:null,
        cached:false,
      });
    }
  }

  const completed=results.filter((item)=>item.checks.some((check)=>check.name!=="analysis" || check.pass)).length;
  const averageScore=results.length
    ? Math.round(results.reduce((sum,item)=>sum+item.score,0)/results.length*10)/10
    : 0;
  return {requested:cases.length,completed,averageScore,results};
}
