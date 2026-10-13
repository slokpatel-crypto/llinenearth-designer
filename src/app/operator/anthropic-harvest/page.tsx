import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
// @ts-ignore -- server-only, shared operational ESM without TS declaration
import { KNOWLEDGE_PACKS } from "../../../../scripts/harvest-anthropic-knowledge.mjs";
import HarvestClient from "./HarvestClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Research Harvest | Linen Earth Operator",
  description: "Operator-only capture of provisional Claude fashion knowledge.",
};

export default async function ResearchHarvestPage() {
  const jar = await cookies();
  if (!(await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value))) {
    redirect("/operator/login?next=/operator/anthropic-harvest");
  }
  const packs: Array<{ id: string; objective: string }> = KNOWLEDGE_PACKS.map((pack: {id:string;objective:string}) => ({
    id: pack.id, objective: pack.objective,
  }));
  return <HarvestClient packs={packs} />;
}
