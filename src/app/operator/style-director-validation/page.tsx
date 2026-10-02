import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import StyleDirectorValidationClient from "./StyleDirectorValidationClient";

export const dynamic="force-dynamic";

export default async function StyleDirectorValidationPage(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)){
    redirect("/operator/login?next=/operator/style-director-validation");
  }
  return <StyleDirectorValidationClient/>;
}
