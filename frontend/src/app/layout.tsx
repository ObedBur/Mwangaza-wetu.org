import type { Metadata } from 'next';
import { connection } from 'next/server';
import './globals.css';
import './home.css';

export const metadata: Metadata = {
  title: 'Mwangaza Wetu - Coopérative d\'Épargne et de Crédit',
  description: 'Mini-Coopérative d\'Épargne et de Crédit Mwangaza Wetu — Épargne, Crédits et Développement',
  icons: {
    icon: [
      { url: '/logo.png', sizes: 'any' },
    ],
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // La CSP à nonce est calculée par requête (`src/proxy.ts`) : chaque page
  // doit donc être rendue dynamiquement pour recevoir le nonce du rendu.
  await connection();

  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className="antialiased bg-[#f6f8f6] text-[#1e293b]"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
