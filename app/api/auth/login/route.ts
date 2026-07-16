import { NextResponse } from "next/server";
import { createSessionToken, validLogin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || "");
    const password = String(body.password || "");
    if (!validLogin(username, password)) {
      return NextResponse.json({ ok: false, error: "Invalid credentials." }, { status: 401 });
    }

    const token = await createSessionToken(username);
    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: "hadith_session",
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    });
    return response;
  } catch (error) {
    console.error("Login route error:", error);
    return NextResponse.json({ ok: false, error: "Login failed." }, { status: 500 });
  }
}
