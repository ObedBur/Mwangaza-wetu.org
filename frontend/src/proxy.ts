import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Origine de l'API autorisée dans `connect-src`.
 * Déduite de `NEXT_PUBLIC_API_URL` : le frontend appelle l'API en direct, en
 * plus du rewrite same-origin `/api`.
 */
function apiOrigin(isDev: boolean): string | null {
  const value = process.env.NEXT_PUBLIC_API_URL || (isDev ? 'http://localhost:4000/api' : null);
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * CSP à nonce, générée pour chaque requête.
 *
 * `'strict-dynamic'` permet aux scripts chargés par le runtime Next (lui-même
 * porteur du nonce) de s'exécuter, tout en bloquant tout script inline injecté
 * par un attaquant. Conséquence assumée : les pages doivent être rendues
 * dynamiquement (voir `await connection()` dans le layout racine), donc plus
 * de cache statique/CDN.
 *
 * `style-src` conserve `'unsafe-inline'` : de nombreux composants utilisent
 * des attributs `style` (que les nonces ne couvrent pas) et le risque
 * d'exfiltration par CSS est très inférieur à celui d'un script injecté.
 */
function contentSecurityPolicy(nonce: string, request: NextRequest): string {
  const isDev = process.env.NODE_ENV === 'development';
  const api = apiOrigin(isDev);
  const connectSources = ["'self'", ...(api ? [api] : [])];

  // Next.js dev client uses a WebSocket for HMR. `self` does not reliably
  // cover ws:// in browsers, so allow only this request's own origin in dev.
  if (isDev) {
    const socketOrigin = new URL(request.url);
    socketOrigin.protocol = socketOrigin.protocol === 'https:' ? 'wss:' : 'ws:';
    connectSources.push(socketOrigin.origin);
  }

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
      isDev ? " 'unsafe-eval'" : ''
    }`,
    // Google Fonts est importé par `home.css` : l'hôte de la feuille de style
    // et celui des fichiers de police doivent être autorisés.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' blob: data: https://res.cloudinary.com https://lh3.googleusercontent.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSources.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  if (!isDev) directives.push('upgrade-insecure-requests');

  return directives.join('; ');
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = contentSecurityPolicy(nonce, request);

  const requestHeaders = new Headers(request.headers);
  // Next.js lit ce nonce pendant le rendu et l'ajoute à ses propres balises
  // <script>. Le nom `x-nonce` permet aussi aux composants serveur de le lire.
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Tout sauf :
     * - api (routes API et rewrite vers le backend)
     * - _next/static (fichiers compilés)
     * - _next/image (optimisation d'images)
     * - favicon.ico
     *
     * Les préchargements Next (`next/link`) sont ignorés : ils renvoient des
     * charges RSC, pas du HTML exécutable.
     */
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
