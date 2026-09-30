import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import DesignerEvaluationClient from "./DesignerEvaluationClient";
import "./designer-evaluation.css";

export const dynamic="force-dynamic";

export default async function DesignerEvaluationPage() {
  const jar=await cookies();
  const valid=await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
  if(!valid) redirect("/operator/login?next=/operator/designer-evaluation");
  return <DesignerEvaluationClient />;
}
