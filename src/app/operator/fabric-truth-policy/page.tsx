import type { Metadata } from "next";
import FabricTruthPolicyClient from "./FabricTruthPolicyClient";
import "./fabric-truth-policy.css";

export const metadata:Metadata={
  title:"Fabric Truth Policy · Linen Earth Operator",
  robots:{index:false,follow:false},
};

export default function FabricTruthPolicyPage(){
  return <FabricTruthPolicyClient/>;
}
