import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

const COOKIE = "ugfish_session";
function secret() { const value = process.env.SESSION_SECRET; if (!value || value.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters"); return value; }
export async function createSession(userId: string) {
  const nonce = randomBytes(24).toString("hex");
  const value = `${userId}.${Date.now()}.${nonce}`;
  const sig = createHmac("sha256", secret()).update(value).digest("hex");
  (await cookies()).set(COOKIE, `${value}.${sig}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 60 * 60 * 24 * 7 });
}
export async function getSessionUser() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split("."); if (parts.length !== 4) return null;
  const [userId, issued, nonce, sig] = parts;
  const value = `${userId}.${issued}.${nonce}`;
  const expected = createHmac("sha256", secret()).update(value).digest("hex");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Date.now() - Number(issued) > 7 * 86400000 || Number(issued) > Date.now()) return null;
  const user = await db.user.findUnique({ where: { id: userId } });
  return user && !user.disabledAt ? user : null;
}
export async function requireUser() { const user = await getSessionUser(); if (!user) throw new Response("Unauthorized", { status: 401 }); return user; }
export async function requireAdmin() { const user = await requireUser(); if (user.role !== "ADMIN") throw new Response("Forbidden", { status: 403 }); return user; }
export function isSameOrigin(request: Request) { const origin = request.headers.get("origin"); return !!origin && origin === new URL(request.url).origin; }
