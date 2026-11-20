import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import QualityInsightsClient from "./QualityInsightsClient";
import "./quality-insights.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Production Quality Insights | Linen Earth",
  robots: { index: false, follow: false },
};

export default async function QualityInsightsPage() {
  const jar = await cookies();
  if (!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value))
    redirect("/operator/login?next=/operator/quality-insights");
  return <QualityInsightsClient />;
}
