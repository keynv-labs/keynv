import './globals.css';
import { ToastFlashHandler } from '@/components/ui/toast-flash-handler';
import { Toaster } from '@/components/ui/toaster';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import { type ReactNode, Suspense } from 'react';

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
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
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
