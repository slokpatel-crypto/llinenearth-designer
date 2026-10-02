import type { Metadata } from "next";
import RoadmapReadinessClient from "./RoadmapReadinessClient";
import "./roadmap-readiness.css";

export const metadata:Metadata={
  title:"Roadmap Readiness · Linen Earth Operator",
  robots:{index:false,follow:false},
};

export default function RoadmapReadinessPage(){
  return <RoadmapReadinessClient/>;
}
