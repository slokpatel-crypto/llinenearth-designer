import { NextResponse } from "next/server";
import { createOperatorSession, OPERATOR_COOKIE } from "@/lib/operator-session";
import { verifyOperatorPassword } from "@/lib/operator-password";
import {
  OPERATOR_LOGIN_JSON_MAX_BYTES,
  operatorLoginRateBlocked,
  parseOperatorLoginPassword,
  type OperatorLoginRateState,
} from "@/lib/operator-login-request";
import {
  readSecureJsonObject, secureJsonRequestError,
  SecureJsonBodyInvalid, SecureJsonBodyTooLarge,
} from "@/lib/secure-json-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const registry = (globalThis as typeof globalThis & {
  __linenOperatorLoginRateV2?: OperatorLoginRateState;
}).__linenOperatorLoginRateV2 ||= {identities:new Map(),global:null};

function json(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("cache-control", "private, no-store, max-age=0");
  response.headers.set("pragma", "no-cache");
  response.headers.set("x-content-type-options", "nosniff");
  return response;
}

export async function POST(request: Request) {
  const unsafe=secureJsonRequestError(request,OPERATOR_LOGIN_JSON_MAX_BYTES);
  if(unsafe) return json({error:unsafe.error},{status:unsafe.status});

  const ip=request.headers.get("x-forwarded-for")||"unknown";
  if(operatorLoginRateBlocked(registry,ip))
    return json({error:"Too many login attempts. Try again later."},{status:429});

  let password:string|null;
  try{
    const body=await readSecureJsonObject(request,OPERATOR_LOGIN_JSON_MAX_BYTES);
    password=parseOperatorLoginPassword(body.password);
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge) return json({error:error.message},{status:413});
    if(error instanceof SecureJsonBodyInvalid) return json({error:error.message},{status:400});
    return json({error:"Unable to read operator sign-in request."},{status:400});
  }
  if(!password) return json({error:"A literal operator password is required."},{status:400});

  if(!process.env.LINEN_OPERATOR_PASSWORD_HASH||!process.env.LINEN_OPERATOR_SESSION_SECRET)
    return json({error:"Operator authentication is not configured."},{status:503});

  try{
    if(!verifyOperatorPassword(password))
      return json({error:"Incorrect operator password."},{status:401});

    const session=await createOperatorSession();
    if(!session)
      return json({error:"Operator session secret is not configured securely."},{status:503});

    const response=json({ok:true});
    response.cookies.set(OPERATOR_COOKIE.name,session,{
      httpOnly:true,
      secure:process.env.NODE_ENV==="production",
      sameSite:"strict",
      path:"/",
      maxAge:OPERATOR_COOKIE.maxAge,
    });
    return response;
  }catch{
    return json({error:"Unable to sign in."},{status:400});
  }
}
