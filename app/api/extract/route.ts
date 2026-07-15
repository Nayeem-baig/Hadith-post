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

async function fetchText(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  return await response.text();
}

async function fetchSunnahHtml(url: string) {
  const encoded = encodeURIComponent(url);
  const direct = await fetch(url, {
    cache: "no-store",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      referer: "https://www.sunnah.com/"
    }
  });
  if (direct.ok) {
    return await direct.text();
  }
  const fallbackSources = [
    `https://api.allorigins.win/raw?url=${encoded}`,
    `https://api.codetabs.com/v1/proxy?quest=${encoded}`,
    `https://r.jina.ai/http://${url.replace(/^https?:\/\//i, "")}`
  ];
  for (const source of fallbackSources) {
    try {
      const html = await fetchText(source);
      if (html && html.length > 500) return html;
    } catch (error) {
      console.error("Sunnah fallback fetch failed:", source, error);
    }
  }
  return null;
}

export async function GET(request: Request) {
  const url = validateSunnahUrl(new URL(request.url).searchParams.get("url"));
  if (!url) {
    return NextResponse.json({ ok: false, error: "Invalid sunnah.com URL." }, { status: 400 });
  }
  try {
    const html = await fetchSunnahHtml(url);
    if (!html) {
      return NextResponse.json({ ok: false, error: "Fetch failed with 403." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, html });
  } catch (error) {
    console.error("Sunnah extraction route failed:", error);
    return NextResponse.json({ ok: false, error: "Could not fetch the page." }, { status: 502 });
  }
}
