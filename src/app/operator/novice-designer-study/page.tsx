import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import NoviceDesignerStudyClient from "./NoviceDesignerStudyClient";

export const dynamic="force-dynamic";

export default async function NoviceDesignerStudyPage(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)){
    redirect("/operator/login?next=/operator/novice-designer-study");
  }
  return <NoviceDesignerStudyClient/>;
}
