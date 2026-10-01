import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import MeasurementCalibrationClient from "./MeasurementCalibrationClient";
import "./measurement-calibration.css";

export const dynamic="force-dynamic";

export default async function MeasurementCalibrationPage(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)) {
    redirect("/operator/login?next=/operator/measurement-calibration");
  }
  return <MeasurementCalibrationClient/>;
}
