import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import DesignerInsightsClient from "./DesignerInsightsClient";
import "./designer-insights.css";

export const dynamic="force-dynamic";

export default async function DesignerInsightsPage(){
  const jar=await cookies();
  const valid=await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
  if(!valid)redirect("/operator/login?next=/operator/designer-insights");
  return <DesignerInsightsClient/>;
}
