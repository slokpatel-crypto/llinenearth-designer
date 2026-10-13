import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import AnthropicKnowledgeClient from "./AnthropicKnowledgeClient";
import "./anthropic-knowledge.css";

export const dynamic="force-dynamic";
export const metadata={title:"Linen Earth — Intelligence Review Desk",robots:{index:false,follow:false}};

export default async function AnthropicKnowledgePage(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)){
    redirect("/operator/login?next=/operator/anthropic-knowledge");
  }
  return <AnthropicKnowledgeClient/>;
}
