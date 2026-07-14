import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();

export function authSecret() {
  return process.env.JWT_SECRET || "";
}

export async function createSessionToken(username: string) {
  const secret = authSecret();
  if (!secret) throw new Error("JWT_SECRET is not configured.");
  return new SignJWT({ username, scope: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encoder.encode(secret));
}

export async function verifySessionToken(token: string | undefined | null) {
  if (!token) return null;
  const secret = authSecret();
  if (!secret) return null;
  try {
    const result = await jwtVerify(token, encoder.encode(secret));
    return (result.payload.username as string | undefined) || null;
  } catch {
    return null;
  }
}

export function validLogin(username: string, password: string) {
  return Boolean(
    process.env.APP_USERNAME &&
    process.env.APP_PASSWORD &&
    username === process.env.APP_USERNAME &&
    password === process.env.APP_PASSWORD
  );
}
