/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["firebase-admin"],
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
