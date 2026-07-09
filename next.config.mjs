/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

// Pragmatic CSP: allows the app's own assets + Google Fonts. Next.js injects some
// inline bootstrap script/style, so 'unsafe-inline' is required for those to work
// without nonces. Tighten further (nonces/hashes) when moving to a custom server.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (isProd ? "" : " 'unsafe-eval'"),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig = {
  // Allow an alternate build dir (e.g. run `next build` while `next dev` holds .next).
  ...(process.env.NEXT_DIST ? { distDir: process.env.NEXT_DIST } : {}),
  poweredByHeader: false,
  // Native/binary-backed packages must not be bundled by webpack (resvg ships a
  // .node addon; better-sqlite3 is native too).
  experimental: { serverComponentsExternalPackages: ["better-sqlite3", "@resvg/resvg-js"] },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Belt-and-suspenders: keep the panel and API out of search results.
      { source: "/gestiune/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};
export default nextConfig;
