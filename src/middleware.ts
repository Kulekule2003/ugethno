import { NextRequest, NextResponse } from "next/server";
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/login" || path === "/api/auth/login" || path.startsWith("/_next/") || path === "/robots.txt" || path === "/favicon.ico") return NextResponse.next();
  if (!request.cookies.has("ugfish_session")) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = request.nextUrl.clone(); url.pathname = "/login"; return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!.*\\.(?:png|jpg|jpeg|webp|svg|ico|css|js)$).*)"] };
