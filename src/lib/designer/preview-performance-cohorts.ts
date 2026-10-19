// Stable front/back × physique matrix for the Node-only preview CPU gate.
// Warm-up previously coupled view parity with build index, sampling only
// four of the eight cohorts. Round-robin over all eight instead.
export const PREVIEW_BENCHMARK_VIEWS=["front","back"] as const;
export const PREVIEW_BENCHMARK_BUILDS=["slim","regular","athletic","broad"] as const;
export const PREVIEW_BENCHMARK_COHORTS=PREVIEW_BENCHMARK_VIEWS.flatMap((view)=>
  PREVIEW_BENCHMARK_BUILDS.map((build)=>`${view}/${build}`));

export function previewBenchmarkWarmupSample(index:number){
  if(!Number.isSafeInteger(index)||index<0) throw new RangeError("Warm-up index must be a nonnegative safe integer.");
  const build=PREVIEW_BENCHMARK_BUILDS[index%PREVIEW_BENCHMARK_BUILDS.length];
  const view=PREVIEW_BENCHMARK_VIEWS[
    Math.floor(index/PREVIEW_BENCHMARK_BUILDS.length)%PREVIEW_BENCHMARK_VIEWS.length
  ];
  return {view,build,key:`${view}/${build}`};
}
