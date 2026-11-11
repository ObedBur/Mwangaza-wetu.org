import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware d'en-têtes de sécurité.
 * Ajoute HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Force HTTPS (à activer uniquement si le backend est derrière HTTPS en prod)
    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload',
      );
    }

    // Empêche le MIME-type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Empêche le clickjacking (le site ne peut pas être embarqué dans un iframe)
    res.setHeader('X-Frame-Options', 'DENY');

    // Politique de référent restreinte
    res.setHeader(
      'Referrer-Policy',
      'strict-origin-when-cross-origin',
    );

    // Content Security Policy restrictive
    // Ajustez 'connect-src' si vous appelez d'autres API externes.
    const csp =
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self'; " +
      "connect-src 'self'; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self';";
    res.setHeader('Content-Security-Policy', csp);

    next();
  }
}
