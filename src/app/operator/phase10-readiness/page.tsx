import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import Phase10ReadinessClient from "./Phase10ReadinessClient";
import "./phase10-readiness.css";

export const dynamic="force-dynamic";

export default async function Phase10ReadinessPage(){
  const jar=await cookies();
  const valid=await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
  if(!valid) redirect("/operator/login?next=/operator/phase10-readiness");
  return <Phase10ReadinessClient />;
}
