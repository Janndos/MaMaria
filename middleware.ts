import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me-in-production");

// Any authenticated customer area.
const CUSTOMER_PATHS = ["/order", "/checkout", "/orders", "/account"];
const STAFF_PREFIX = "/gestiune";
// The only sections a "tehno" operator may open (admins see everything).
const TEHNO_ALLOWED = ["/gestiune/meniu", "/gestiune/comenzi", "/gestiune/utilizatori"];

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

  // The staff panel does not acknowledge its existence to non-staff sessions,
  // and a tehno operator only sees its three allowed sections.
  if (isStaff) {
    const role = payload.role;
    if (role !== "admin" && role !== "tehno") {
      return new NextResponse(null, { status: 404 });
    }
    if (role === "tehno") {
      const allowed = TEHNO_ALLOWED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
      if (!allowed) return new NextResponse(null, { status: 404 });
    }
  }

  const res = NextResponse.next();
  // Never let the staff panel be indexed or embedded.
  if (isStaff) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
}

export const config = { matcher: ["/order/:path*", "/checkout/:path*", "/orders/:path*", "/account/:path*", "/gestiune/:path*"] };
