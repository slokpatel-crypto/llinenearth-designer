export function normalizeCustomerEmail(value:unknown){
  const email=String(value||"").trim().toLowerCase();
  if(email.length<5||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}
