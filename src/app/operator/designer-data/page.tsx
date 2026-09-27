import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import DesignerDataClient from "./DesignerDataClient";
import "./designer-data.css";

export const dynamic = "force-dynamic";

export default async function DesignerDataPage() {
  const jar = await cookies();
  const valid = await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
  if (!valid) redirect("/operator/login?next=/operator/designer-data");
  return <DesignerDataClient />;
}
