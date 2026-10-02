import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import LaunchReadinessClient from "./LaunchReadinessClient";
import "./launch-readiness.css";

export const dynamic="force-dynamic";

export default async function LaunchReadinessPage(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)){
    redirect("/operator/login?next=/operator/launch-readiness");
  }
  return <LaunchReadinessClient/>;
}
