export const PRIMARY_VERCEL_PROJECT_ID="prj_b3rwwOl5OI0VV3qYyKXPFOloCllT" as const;

export type ProductionRuntimeHealthInput={
  vercel?:unknown;
  environment?:unknown;
  targetEnvironment?:unknown;
  projectId?:unknown;
  deploymentId?:unknown;
  deploymentUrl?:unknown;
  productionUrl?:unknown;
  commitSha?:unknown;
};

function clean(value:unknown,limit=240){
  return typeof value==="string"?value.trim().slice(0,limit):"";
}

export function summarizeProductionRuntimeHealth(input:ProductionRuntimeHealthInput){
  const vercel=input.vercel===true||clean(input.vercel)==="1";
  const environment=clean(input.environment,40);
  const targetEnvironment=clean(input.targetEnvironment,40);
  const projectId=clean(input.projectId,120);
  const deploymentId=clean(input.deploymentId,120);
  const deploymentUrl=clean(input.deploymentUrl,240);
  const productionUrl=clean(input.productionUrl,240);
  const commitSha=clean(input.commitSha,64).toLowerCase();

  const checks={
    vercel,
    productionEnvironment:environment==="production",
    productionTarget:targetEnvironment===""||targetEnvironment==="production",
    primaryProject:projectId===PRIMARY_VERCEL_PROJECT_ID,
    deploymentIdentity:/^dpl_[A-Za-z0-9]+$/.test(deploymentId),
    deploymentUrl:deploymentUrl.length>3&&deploymentUrl.includes("."),
    productionUrl:productionUrl.length>3&&productionUrl.includes("."),
    gitCommit:/^[0-9a-f]{40}$/.test(commitSha),
  };
  const gateComplete=Object.values(checks).every(Boolean);
  const missing=Object.entries(checks).filter(([,pass])=>!pass).map(([key])=>key);
  return {
    gateComplete,
    checks,
    missing,
    environment:environment||null,
    targetEnvironment:targetEnvironment||null,
    projectId:projectId||null,
    deploymentId:deploymentId||null,
    deploymentUrl:deploymentUrl||null,
    productionUrl:productionUrl||null,
    commitSha:commitSha||null,
  };
}

export function productionRuntimeHealthFromEnv(env:NodeJS.ProcessEnv=process.env){
  return summarizeProductionRuntimeHealth({
    vercel:env.VERCEL,
    environment:env.VERCEL_ENV,
    targetEnvironment:env.VERCEL_TARGET_ENV,
    projectId:env.VERCEL_PROJECT_ID,
    deploymentId:env.VERCEL_DEPLOYMENT_ID,
    deploymentUrl:env.VERCEL_URL,
    productionUrl:env.VERCEL_PROJECT_PRODUCTION_URL,
    commitSha:env.VERCEL_GIT_COMMIT_SHA || env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  });
}
