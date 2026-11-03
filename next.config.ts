import type { NextConfig } from "next";

// Signed image URLs point at the object store, so its origin must be allowed in img-src.
function storageOrigin() {
  if (process.env.S3_ENDPOINT) return new URL(process.env.S3_ENDPOINT).origin;
  if (process.env.S3_BUCKET) return `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION || "us-east-1"}.amazonaws.com`;
  return "";
}

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: `default-src 'self'; img-src 'self' blob: data: ${storageOrigin()}; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` }
    ] }];
  }
};
export default nextConfig;
