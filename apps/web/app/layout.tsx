import './globals.css';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import { type ReactNode } from 'react';

export const metadata: Metadata = {
  metadataBase: new URL('https://keynv.dev'),
  title: {
    template: '%s · keynv',
    default: 'keynv',
  },
  description: 'AI-safe secrets management dashboard',
  robots: { index: true, follow: true },
  // icon.svg + apple-icon.tsx are auto-detected from app/ — no explicit
  // <link> needed.
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
