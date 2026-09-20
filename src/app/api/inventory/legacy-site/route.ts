import { NextResponse } from "next/server";

const LEGACY_CATEGORIES = [
  { id: "60lea-plain", label: "60 Lea Plain", path: "/60lea-plain.php" },
  { id: "60lea-formals", label: "60 Lea Formals", path: "/60lea-formals.php" },
  { id: "75lea-formals", label: "75 Lea Formals", path: "/75lea-formals.php" },
  { id: "cotton-plain", label: "Cotton Plain", path: "/cotton-plain.php" },
  { id: "cotton-print", label: "Cotton Print", path: "/cotton-print.php" },
  { id: "digital-print", label: "Digital Print", path: "/digital-print.php" },
  { id: "linen-suiting", label: "Linen Suiting", path: "/linen-suiting.php" },
  { id: "luxurious-cotton", label: "Luxurious Cotton", path: "/luxurious-cotton.php" },
] as const;

const BASE = "https://llinenearth.com";

function absoluteUrl(value: string, pageUrl: string) {
  try {
    return new URL(value, pageUrl).toString();
  } catch {
    return null;
  }
}

function decodeHtml(value: string) {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(value: string) {
  return decodeHtml(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1]?.trim() || "";
}

function looksLikeUiAsset(src: string) {
  return /logo|icon|whatsapp|facebook|instagram|loader|banner|slider|category-home|favicon|payment|arrow/i.test(src);
}

function extractImages(html: string, pageUrl: string) {
  const matches = [...html.matchAll(/<img\b[^>]*>/gi)];
  const seen = new Set<string>();
  const images: Array<{ src: string; alt: string; title: string; nearbyText: string }> = [];

  for (const match of matches) {
    const tag = match[0];
    const raw = attr(tag, "src") || attr(tag, "data-src") || attr(tag, "data-lazy-src");
    if (!raw) continue;
    const src = absoluteUrl(raw, pageUrl);
    if (!src || seen.has(src) || looksLikeUiAsset(src)) continue;
    seen.add(src);

    const index = match.index ?? 0;
    const nearby = stripHtml(html.slice(Math.max(0, index - 260), Math.min(html.length, index + tag.length + 340)));

    images.push({
      src,
      alt: decodeHtml(attr(tag, "alt")),
      title: decodeHtml(attr(tag, "title")),
      nearbyText: nearby.slice(0, 280),
    });
  }
  return images;
}

function extractLinks(html: string, pageUrl: string) {
  const links: Array<{ href: string; text: string }> = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = absoluteUrl(match[1], pageUrl);
    const text = stripHtml(match[2]).slice(0, 140);
    if (!href || !text || seen.has(href)) continue;
    if (!href.startsWith(BASE)) continue;
    seen.add(href);
    links.push({ href, text });
  }
  return links;
}

async function readCategory(category: (typeof LEGACY_CATEGORIES)[number]) {
  const pageUrl = `${BASE}${category.path}`;
  try {
    const response = await fetch(pageUrl, {
      headers: {
        "user-agent": "LLinenEarthInventorySync/1.0 (+https://llinenearth.com)",
        accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      return { ...category, pageUrl, ok: false, status: response.status, images: [], links: [] };
    }
    const html = await response.text();
    return {
      ...category,
      pageUrl,
      ok: true,
      status: response.status,
      title: stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ""),
      images: extractImages(html, pageUrl),
      links: extractLinks(html, pageUrl),
    };
  } catch (error) {
    return {
      ...category,
      pageUrl,
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Legacy website request failed.",
      images: [],
      links: [],
    };
  }
}

export async function GET() {
  const categories = await Promise.all(LEGACY_CATEGORIES.map(readCategory));
  return NextResponse.json({
    source: BASE,
    capturedAt: new Date().toISOString(),
    categories,
    totals: {
      categories: categories.length,
      reachable: categories.filter((category) => category.ok).length,
      images: categories.reduce((sum, category) => sum + category.images.length, 0),
    },
  });
}
