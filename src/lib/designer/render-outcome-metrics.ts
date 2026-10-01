export type RenderOutcomeMetricInput={
  credits_used:number;
  cached:boolean;
  human_status:"pending"|"approved"|"rejected";
  qa_status:"pass"|"review"|null;
};

export function summarizeRenderOutcomes(rows:RenderOutcomeMetricInput[]){
  const generated=rows.filter((row)=>!row.cached);
  const reviewed=rows.filter((row)=>row.human_status!=="pending");
  const approved=rows.filter((row)=>row.human_status==="approved");
  const rejected=rows.filter((row)=>row.human_status==="rejected");
  const qaPass=rows.filter((row)=>row.qa_status==="pass");
  const totalCredits=generated.reduce((sum,row)=>sum+Math.max(0,Number(row.credits_used)||0),0);
  const approvalRate=reviewed.length?approved.length/reviewed.length:null;
  const creditsPerApproved=approved.length?totalCredits/approved.length:null;
  return {
    total:rows.length,
    generated:generated.length,
    cached:rows.length-generated.length,
    reviewed:reviewed.length,
    pending:rows.length-reviewed.length,
    approved:approved.length,
    rejected:rejected.length,
    qaPass:qaPass.length,
    totalCredits:Math.round(totalCredits*10000)/10000,
    approvalRate:approvalRate===null?null:Math.round(approvalRate*1000)/10,
    creditsPerApproved:creditsPerApproved===null?null:Math.round(creditsPerApproved*10000)/10000,
  };
}


export type RenderPatternCalibrationMetricInput={
  scale_error_pct:number;
  axis_status:"match"|"mismatch"|"not_applicable";
};

export function summarizeRenderPatternCalibrations(rows:RenderPatternCalibrationMetricInput[]){
  const valid=rows.filter((row)=>Number.isFinite(Number(row.scale_error_pct))&&Number(row.scale_error_pct)>=0);
  const pass=valid.filter((row)=>Number(row.scale_error_pct)<=8&&row.axis_status!=="mismatch");
  const averageError=valid.length
    ? valid.reduce((sum,row)=>sum+Number(row.scale_error_pct),0)/valid.length
    : null;
  return {
    total:valid.length,
    pass:pass.length,
    fail:valid.length-pass.length,
    passRate:valid.length?Math.round(pass.length/valid.length*1000)/10:null,
    averageScaleErrorPct:averageError===null?null:Math.round(averageError*100)/100,
  };
}


export type RenderPatternCoverageOutcomeInput={
  outcome_id:string;
  shirt_id:string;
  pant_id:string;
  human_status:"pending"|"approved"|"rejected";
};

export type RenderPatternCoverageCalibrationInput={
  outcome_id:string;
  garment:"shirt"|"trouser";
  expected_repeat_mm?:number;
  scale_error_pct:number;
  axis_status:"match"|"mismatch"|"not_applicable";
  measurement_method?:"legacy_direct_mm"|"pixel_fixture_v2";
  created_at:string;
};

export function summarizeApprovedPatternCalibrationCoverage(
  outcomes:RenderPatternCoverageOutcomeInput[],
  calibrations:RenderPatternCoverageCalibrationInput[],
  patternedFabricIds:Set<string>,
  expectedRepeatByFabric?:ReadonlyMap<string,number>,
){
  const latest=new Map<string,RenderPatternCoverageCalibrationInput>();
  for(const row of calibrations){
    const key=`${row.outcome_id}::${row.garment}`;
    const current=latest.get(key);
    const incomingAt=new Date(row.created_at).getTime()||0;
    const currentAt=current ? new Date(current.created_at).getTime()||0 : -1;
    if(!current||incomingAt>currentAt) latest.set(key,row);
  }

  const requirements:Array<{outcomeId:string;garment:"shirt"|"trouser";fabricId:string}>= [];
  for(const row of outcomes){
    if(row.human_status!=="approved") continue;
    if(patternedFabricIds.has(row.shirt_id)) requirements.push({outcomeId:row.outcome_id,garment:"shirt",fabricId:row.shirt_id});
    if(patternedFabricIds.has(row.pant_id)) requirements.push({outcomeId:row.outcome_id,garment:"trouser",fabricId:row.pant_id});
  }

  let passed=0,failed=0,pending=0,missingTruth=0,staleCalibration=0,legacyCalibration=0;
  for(const requirement of requirements){
    const verifiedExpected=expectedRepeatByFabric?.get(requirement.fabricId);
    if(expectedRepeatByFabric && (!Number.isFinite(verifiedExpected)||Number(verifiedExpected)<=0)){
      pending+=1;
      missingTruth+=1;
      continue;
    }

    const calibration=latest.get(`${requirement.outcomeId}::${requirement.garment}`);
    if(!calibration){pending+=1;continue;}

    if(expectedRepeatByFabric && calibration.measurement_method!=="pixel_fixture_v2"){
      pending+=1;
      legacyCalibration+=1;
      continue;
    }

    if(expectedRepeatByFabric){
      const recordedExpected=Number(calibration.expected_repeat_mm);
      const expected=Number(verifiedExpected);
      const sameReviewedTruth=
        Number.isFinite(recordedExpected)&&
        Math.round(recordedExpected*100)===Math.round(expected*100);
      if(!sameReviewedTruth){
        pending+=1;
        staleCalibration+=1;
        continue;
      }
    }

    const error=Number(calibration.scale_error_pct);
    const pass=Number.isFinite(error)&&error>=0&&error<=8&&calibration.axis_status!=="mismatch";
    if(pass) passed+=1;
    else failed+=1;
  }

  return {
    requiredPairs:requirements.length,
    calibratedPairs:passed+failed,
    passedPairs:passed,
    failedPairs:failed,
    pendingPairs:pending,
    missingTruthPairs:missingTruth,
    staleCalibrationPairs:staleCalibration,
    legacyCalibrationPairs:legacyCalibration,
    gateComplete:requirements.length>0&&failed===0&&pending===0&&passed===requirements.length,
  };
}
