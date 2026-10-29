/** Legacy gallery HTML is an unverified external input. Accept only HTTPS
 * resources on the actual page origin, never a lookalike hostname, protocol,
 * credential-bearing URL or unrelated CDN. Product evidence stays unverified. */
export function sameOriginLegacyGalleryUrl(raw:unknown,pageUrl:unknown):string|null {
  if(typeof raw!=="string"||typeof pageUrl!=="string") return null;
  try {
    const page=new URL(pageUrl);
    const candidate=new URL(raw,page);
    if(page.protocol!=="https:"||candidate.protocol!=="https:"
       ||candidate.origin!==page.origin||candidate.username||candidate.password)
      return null;
    return candidate.toString();
  }catch {
    return null;
  }
}
