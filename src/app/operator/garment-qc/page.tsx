import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import GarmentQcClient from "./GarmentQcClient";
import "./garment-qc.css";

export const dynamic="force-dynamic";

export default async function GarmentQcPage(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)){
    redirect("/operator/login?next=/operator/garment-qc");
  }
  return <GarmentQcClient/>;
}
