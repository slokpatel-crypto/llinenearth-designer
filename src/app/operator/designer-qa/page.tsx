import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import DesignerQaClient from "./DesignerQaClient";
import "./designer-qa.css";

export const dynamic = "force-dynamic";

export default async function DesignerQaPage() {
  const jar = await cookies();
  const valid = await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
  if (!valid) redirect("/operator/login?next=/operator/designer-qa");
  return <DesignerQaClient />;
}
