import { NextResponse } from "next/server";
import { getBufferBootstrap } from "@/lib/buffer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId") || undefined;
  try {
    const data = await getBufferBootstrap(organizationId);
    return NextResponse.json({ configured: true, ...data });
  } catch (error) {
    console.error("Buffer bootstrap failed:", error);
    return NextResponse.json({
      configured: false,
      error: error instanceof Error ? error.message : "Buffer is not configured.",
      organizations: [],
      channels: [],
      posts: []
    });
  }
}
