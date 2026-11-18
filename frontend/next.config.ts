import type { NextConfig } from "next";

/**
 * En-têtes de sécurité statiques.
 *
 * La Content-Security-Policy n'est plus définie ici : elle dépend d'un nonce
 * généré par requête et est posée par `src/proxy.ts`. En déclarer une seconde
 * ici l'appliquerait en intersection et bloquerait les scripts de Next.
 */
const nextConfig: NextConfig = {
  transpilePackages: ["@radix-ui/react-select", "lucide-react"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:4000/api/:path*",
      },
    ];
  },

  async headers() {
    const headers = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ];
    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }
    return [
      {
        source: "/(.*)",
        headers,
      },
    ];
  },
};

export default nextConfig;
