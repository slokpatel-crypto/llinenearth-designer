import { summarizeRoadmapReadiness, type RoadmapReadinessInput } from "./roadmap-readiness.ts";

export type EvidenceSprintAvailability="now"|"parallel"|"later";
export type EvidenceSprintTrack="physical"|"customer"|"render"|"production"|"learning";

export type EvidenceSprintItem={
  id:string;
  phase:number;
  track:EvidenceSprintTrack;
  availability:EvidenceSprintAvailability;
  title:string;
  action:string;
  proof:string;
  href:string;
  complete:boolean;
  progressPercent:number;
};

const TASKS:Array<Omit<EvidenceSprintItem,"complete"|"progressPercent"|"availability"> & {dependsOn?:number[]}>=[
  {
    id:"premium-shirt-proof",
    phase:1,
    track:"physical",
    title:"Premium Shirt Proof",
    action:"Record one physically measured repeat, protected-boundary review, independent realism ratings and target-mobile Device QA.",
    proof:"Physical cloth + 8 distinct viewers + accepted mobile evidence",
    href:"/lab/proof",
  },
  {
    id:"fabric-truth",
    phase:2,
    track:"physical",
    title:"Fabric Truth",
    action:"Review the first 50 stock fabrics, complete controlled colour checks, and fill GSM / fibre / drape / physical-scale evidence to the approved owner policy.",
    proof:"Owner/supplier physical provenance against the approved Fabric Truth policy",
    href:"/operator/fabric-truth-policy",
  },
  {
    id:"deterministic-designer",
    phase:3,
    track:"customer",
    title:"Deterministic Designer validation",
    action:"Clear every visible customer preview option and run five real novice completions on the server stopwatch.",
    proof:"All visible preview reviews + five server-timed novice successes",
    href:"/operator/preview-option-coverage",
    dependsOn:[1],
  },
  {
    id:"measurement-fit",
    phase:4,
    track:"physical",
    title:"Measurements / Fit",
    action:"Record real self-vs-tailor measurement comparisons, complete the finished-garment ease grid, and approve the house ease model.",
    proof:"Real-person accuracy + real finished-garment ease + owner/tailor approval",
    href:"/operator/measurement-calibration",
  },
  {
    id:"lock-share",
    phase:5,
    track:"customer",
    title:"Lock / Share / Enquiry",
    action:"Run five distinct real customer lock → verified share/enquiry flows with no blocking bug.",
    proof:"Five unique verified locked revisions with server-audited share/enquiry evidence",
    href:"/operator/launch-readiness",
  },
  {
    id:"style-director",
    phase:6,
    track:"customer",
    title:"Style Director validation",
    action:"Set the owner clean-case target, record distinct signed Style Director handoffs, and complete human sign-off.",
    proof:"Owner threshold + non-replayed real-user cases + approval",
    href:"/operator/style-director-validation",
  },
  {
    id:"final-render",
    phase:7,
    track:"render",
    title:"Final Render / QA",
    action:"Review real final renders, verify cross-view identity, set the owner credit cap, sign off manual review, and physically check patterned render scale.",
    proof:"20+ reviewed renders, approval/cost evidence, identity checks and physical pattern calibration",
    href:"/operator/render-qa",
  },
  {
    id:"production-bridge",
    phase:8,
    track:"production",
    title:"Production Bridge",
    action:"Approve shirt and trouser meterage models from real cuts and record ten provenance-backed zero-reentry deliveries.",
    proof:"Approved physical meterage tables + 10 delivered zero-reentry orders",
    href:"/operator/production-evidence",
    dependsOn:[5],
  },
  {
    id:"launch-hardening",
    phase:9,
    track:"customer",
    title:"Hardening / Launch",
    action:"Finish the five-case beta, human launch checklist and accepted mobile/tablet/desktop Device QA. Backend and production-runtime checks stay automatic.",
    proof:"Real beta + human sign-off + 3/3 accepted target devices",
    href:"/operator/launch-readiness",
  },
  {
    id:"closed-loop",
    phase:11,
    track:"learning",
    title:"Closed-loop outcomes",
    action:"After delivery, collect wear-confirmed outcomes, review them, and record the human learning threshold policy.",
    proof:"Real delivered-order outcomes + human review/policy",
    href:"/operator/customer-outcomes",
    dependsOn:[8],
  },
];

export function buildEvidenceSprint(input:RoadmapReadinessInput){
  const readiness=summarizeRoadmapReadiness(input);
  const phaseMap=new Map(readiness.phases.map((item)=>[item.phase,item]));
  const items:EvidenceSprintItem[]=TASKS.map((task)=>{
    const state=phaseMap.get(task.phase);
    const complete=Boolean(state?.evidenceComplete);
    const dependencies=(task.dependsOn||[]).map((phase)=>phaseMap.get(phase));
    const depsComplete=dependencies.every((dep)=>dep?.evidenceComplete===true);
    const availability:EvidenceSprintAvailability=complete
      ?"later"
      :dependencies.length===0||depsComplete
        ?"now"
        :task.phase===3
          ?"parallel"
          :"later";
    return {
      id:task.id,
      phase:task.phase,
      track:task.track,
      title:task.title,
      action:task.action,
      proof:task.proof,
      href:task.href,
      complete,
      progressPercent:state?.progressPercent??0,
      availability,
    };
  });

  const open=items.filter((item)=>!item.complete);
  const now=open.filter((item)=>item.availability==="now");
  const parallel=open.filter((item)=>item.availability==="parallel");
  const later=open.filter((item)=>item.availability==="later");
  const completed=items.filter((item)=>item.complete);

  return {
    items,
    now,
    parallel,
    later,
    completed,
    next:now.slice(0,3),
    completeCount:completed.length,
    total:items.length,
    progressPercent:items.length?Math.round(completed.length/items.length*100):0,
  };
}
