import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import RenderQaClient from "./RenderQaClient";
import "./render-qa.css";

export const dynamic="force-dynamic";

export default async function RenderQaPage(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)) redirect("/operator/login?next=/operator/render-qa");
  return <RenderQaClient/>;
}
