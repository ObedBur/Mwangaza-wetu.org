import type { NextConfig } from "next";

/**
 * Origine de l'API autorisée dans `connect-src` (CSP).
 * Déduite de `NEXT_PUBLIC_API_URL` : le frontend appelle l'API en direct, pas
 * seulement via le rewrite `/api`.
 */
function apiOrigin(): string | null {
  const value = process.env.NEXT_PUBLIC_API_URL;
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * CSP de base servie par Next.js.
 *
 * Volontairement sans nonce : le mode nonce impose le rendu dynamique de
 * toutes les pages (et casse le cache statique). On garde donc
 * `'unsafe-inline'` pour les scripts, mais on ferme les vecteurs qui ne
 * dépendent pas de l'inline : `object-src`, `base-uri`, `frame-ancestors`,
 * et surtout `img-src`/`connect-src` (exfiltration par balise image).
 * L'étape suivante, si le rendu dynamique est acceptable, est le nonce.
 */
function contentSecurityPolicy(): string {
  const api = apiOrigin();
  const connectSrc = ["'self'", ...(api ? [api] : [])].join(" ");
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (process.env.NODE_ENV === "production") {
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}

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
      { key: "Content-Security-Policy", value: contentSecurityPolicy() },
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
