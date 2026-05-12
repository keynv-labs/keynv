import './globals.css';
import { ToastFlashHandler } from '@/components/ui/toast-flash-handler';
import { Toaster } from '@/components/ui/toaster';
import type { Metadata } from 'next';
import { Fraunces, JetBrains_Mono, Newsreader } from 'next/font/google';
import { type ReactNode, Suspense } from 'react';

/**
 * Type stack — Redacted Dossier identity.
 *
 *   Display : Fraunces  — opsz-variable serif, characterful at 96–144,
 *             readable at 24. Used for editorial headlines and pull
 *             quotes only. Avoided in dashboard chrome.
 *   Body    : Newsreader — variable serif body face designed for long-
 *             form reading (Google). Marketing prose is in Newsreader;
 *             dashboard UI also routes through it for continuity but
 *             relies on UI-scale sizes where serif texture is invisible.
 *   Mono    : JetBrains Mono — retained for code, transcripts, stamps.
 *             Iconic for the developer audience; no replacement worth
 *             the swap.
 *
 * All three are variable fonts loaded once at the root via next/font so
 * the dashboard, docs, and marketing share a single FOUT-free pipeline.
 */
const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display-loaded',
  display: 'swap',
  style: ['normal', 'italic'],
  axes: ['SOFT', 'opsz'],
});

const body = Newsreader({
  subsets: ['latin'],
  variable: '--font-body-loaded',
  display: 'swap',
  style: ['normal', 'italic'],
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-loaded',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://keynv.dev'),
  title: {
    template: '%s · keynv',
    default: 'keynv',
  },
  description: 'AI-safe secrets management dashboard',
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">
        {children}
        <Toaster />
        <Suspense fallback={null}>
          <ToastFlashHandler />
        </Suspense>
      </body>
    </html>
  );
}
