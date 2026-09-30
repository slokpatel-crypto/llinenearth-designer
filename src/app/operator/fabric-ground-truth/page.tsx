import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import FabricGroundTruthClient from "./FabricGroundTruthClient";
import "./fabric-ground-truth.css";

export const dynamic="force-dynamic";

export default async function FabricGroundTruthPage() {
  const jar=await cookies();
  const valid=await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
  if(!valid) redirect("/operator/login?next=/operator/fabric-ground-truth");
  return <FabricGroundTruthClient />;
}
