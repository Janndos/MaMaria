import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me-in-production");

// Any authenticated customer area.
const CUSTOMER_PATHS = ["/order", "/checkout", "/orders", "/account"];
const STAFF_PREFIX = "/gestiune";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isStaff = pathname.startsWith(STAFF_PREFIX);
  const needsAuth = isStaff || CUSTOMER_PATHS.some((p) => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get("mamaria_session")?.value;
  let payload: { uid?: unknown; role?: unknown } | null = null;
  if (token) {
    try { payload = (await jwtVerify(token, secret)).payload as any; } catch { payload = null; }
  }

  if (!payload) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // The staff panel does not acknowledge its existence to non-staff sessions.
  if (isStaff && payload.role !== "admin") {
    return new NextResponse(null, { status: 404 });
  }

  const res = NextResponse.next();
  // Never let the staff panel be indexed or embedded.
  if (isStaff) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
}

export const config = { matcher: ["/order/:path*", "/checkout/:path*", "/orders/:path*", "/account/:path*", "/gestiune/:path*"] };
