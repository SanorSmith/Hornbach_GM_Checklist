import type { Metadata, Viewport } from 'next';
import { t } from '@/lib/i18n';
import './globals.css';

export const metadata: Metadata = {
  title: 'GM Checklista',
  description: 'Digitala checklistor för Godsmottagningen på Hornbach.',
  // Employee records: never index, never follow.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom stays enabled on purpose: small text, bright sun, safety glasses.
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FF7300' },
    { media: '(prefers-color-scheme: dark)', color: '#16181D' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv" suppressHydrationWarning>
      <body>
        <a href="#main" className="gm-sr-only">
          {t('worker.pickList')}
        </a>
        <div id="main">{children}</div>
      </body>
    </html>
  );
}
