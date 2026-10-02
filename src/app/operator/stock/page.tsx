import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import StockClient from "./StockClient";
import "./stock.css";

export const dynamic="force-dynamic";

export default async function StockPage(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)) redirect("/operator/login?next=/operator/stock");
  return <StockClient/>;
}
