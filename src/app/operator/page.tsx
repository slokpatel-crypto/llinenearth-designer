import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import OperatorClient from "./OperatorClient";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";

export const dynamic = "force-dynamic";

export default async function OperatorPage() {
  const jar = await cookies();
  const valid = await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);

  if (!valid) {
    redirect("/operator/login?next=/operator");
  }

  return <OperatorClient />;
}
