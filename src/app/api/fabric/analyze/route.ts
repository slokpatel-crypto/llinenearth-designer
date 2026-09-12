import { NextResponse } from "next/server";
import { analyzeFabricDevelopment } from "@/lib/fabric-analysis";

const MAX_UPLOAD = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileName, contentType, size } = body ?? {};

    if (!fileName || !contentType || typeof size !== "number") {
      return NextResponse.json({ error: "Missing file metadata." }, { status: 400 });
    }

    if (!String(contentType).startsWith("image/")) {
      return NextResponse.json({ error: "Please upload an image file." }, { status: 415 });
    }

    if (size > MAX_UPLOAD) {
      return NextResponse.json({ error: "Image must be 10 MB or smaller." }, { status: 413 });
    }

    const profile = analyzeFabricDevelopment({ fileName, contentType, size });
    return NextResponse.json({ profile, mode: "development_mock" });
  } catch {
    return NextResponse.json({ error: "Unable to analyze this fabric right now." }, { status: 500 });
  }
}
