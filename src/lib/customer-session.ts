import "server-only";
import { readBrandEnv } from "@/lib/runtime-compat";
import {
  CUSTOMER_SESSION_MAX_AGE_SECONDS,
  createCustomerSessionToken,
  verifyCustomerSessionToken,
  type CustomerSessionIdentity,
} from "@/lib/customer-session-token";

export const CUSTOMER_SESSION_COOKIE="le_customer_session";

function secret(){
  const value=readBrandEnv("LINEN_CUSTOMER_SESSION_SECRET");
  return value&&value.length>=32?value:null;
}

export function customerSessionConfigured(){
  return Boolean(secret());
}

export function createSignedCustomerSession(identity:CustomerSessionIdentity){
  const value=secret();
  return value?createCustomerSessionToken(value,identity):null;
}

export function verifySignedCustomerSession(token:unknown){
  const value=secret();
  return value?verifyCustomerSessionToken(value,token):null;
}

export const CUSTOMER_SESSION_COOKIE_OPTIONS={
  httpOnly:true,
  secure:process.env.NODE_ENV==="production",
  sameSite:"lax" as const,
  path:"/",
  maxAge:CUSTOMER_SESSION_MAX_AGE_SECONDS,
};
