import type { Metadata } from 'next';
import './globals.css';
import './home.css';

export const metadata: Metadata = {
  title: 'Mwangaza Wetu - Administration Coopérative',
  description: 'Système de gestion et d\'administration de la Coopérative Mwangaza Wetu',
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
