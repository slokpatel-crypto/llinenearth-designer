import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import ConstructionApprovalClient from "./ConstructionApprovalClient";
import "./construction-approval.css";

export const dynamic="force-dynamic";

export default async function ConstructionApprovalPage() {
  const jar=await cookies();
  const valid=await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
  if(!valid) redirect("/operator/login?next=/operator/construction-approval");
  return <ConstructionApprovalClient />;
}
