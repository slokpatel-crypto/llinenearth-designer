/** An exact browser-generated v4 UUID represents one intended production
 * create operation. No coercion from objects/arrays/numbers or fallback to a
 * server-generated key (which would make a lost-receipt retry unsafe). */
export function parseOperatorProductionRequestKey(value:unknown):string|null{
  if(typeof value!=="string")return null;
  const key=value.trim().toLowerCase();
  return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(key)?key:null;
}
