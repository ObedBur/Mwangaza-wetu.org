import type { Metadata } from 'next';
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="antialiased bg-[#f6f8f6] text-[#1e293b]">
        {children}
      </body>
    </html>
  );
}
