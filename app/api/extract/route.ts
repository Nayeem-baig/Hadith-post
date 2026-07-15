import { NextResponse } from "next/server";

export const runtime = "nodejs";

function validateSunnahUrl(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.hostname !== "sunnah.com" && parsed.hostname !== "www.sunnah.com") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = validateSunnahUrl(new URL(request.url).searchParams.get("url"));
  if (!url) {
    return NextResponse.json({ ok: false, error: "Invalid sunnah.com URL." }, { status: 400 });
  }
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
      }
    });
    if (!response.ok) {
      return NextResponse.json({ ok: false, error: `Fetch failed with ${response.status}.` }, { status: 502 });
    }
    const html = await response.text();
    return NextResponse.json({ ok: true, html });
  } catch (error) {
    console.error("Sunnah extraction route failed:", error);
    return NextResponse.json({ ok: false, error: "Could not fetch the page." }, { status: 502 });
  }
}
