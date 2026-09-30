/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["firebase-admin"],
    // Email bodies live beside their route (app/{slug}/index.html) and are read
    // at runtime through a computed path, so tracing cannot infer them. Without
    // this they are missing from the deployed bundle and every send fails.
    outputFileTracingIncludes: {
      "/api/reg": ["./app/**/*.html", "./public/reg/*.html"],
      "/api/cron/automations": ["./app/**/*.html", "./public/reg/*.html"],
      "/api/admin/automations/[kind]": ["./app/**/*.html", "./public/reg/*.html"],
    },
  },
  // The per-drive thank-you routes were replaced by a single /thank-you.
  // Keep old links (bookmarks, and forms loaded before the deploy) working;
  // Next.js carries the query string across the redirect.
  async redirects() {
    return [
      { source: "/reg/thank-you", destination: "/thank-you", permanent: false },
      {
        source: "/marathahalli-fsd-oct-2026/thank-you",
        destination: "/thank-you",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
