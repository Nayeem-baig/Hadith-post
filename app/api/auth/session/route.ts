import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("hadith_session")?.value;
  const username = await verifySessionToken(token);
  return NextResponse.json({ authenticated: Boolean(username), username });
}
