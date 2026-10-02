import type { Metadata } from "next";
import EvidenceSprintClient from "./EvidenceSprintClient";
import "./evidence-sprint.css";

export const metadata:Metadata={
  title:"Evidence Sprint · Linen Earth Operator",
  robots:{index:false,follow:false},
};

export default function EvidenceSprintPage(){
  return <EvidenceSprintClient/>;
}
