import type { Metadata, Viewport } from 'next';
import { Archivo_Black, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { preconnect, prefetchDNS } from 'react-dom';
import { Nav } from '@/components/Nav';
import { VUScroll } from '@/components/VUScroll';
import './globals.css';

/**
 * Cover art hosts — warm DNS+TLS before the first cover request so a cold
 * page doesn't pay connection setup on the critical path. archive.org is the
 * CAA 307-redirect target. No crossOrigin: covers load as no-cors <img>
 * requests, and a CORS-mode preconnect would open a connection the browser
 * can't reuse for them.
 */
const COVER_HOSTS = [
  'https://coverartarchive.org',
  'https://archive.org',
  'https://is1-ssl.mzstatic.com',
];

const archivo = Archivo_Black({
  weight: '400',
  variable: '--font-archivo',
  subsets: ['latin'],
  display: 'swap',
});

const plexSans = IBM_Plex_Sans({
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
  subsets: ['latin'],
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Ordko — ranked lists for record obsessives', template: '%s — Ordko' },
  description:
    'Publish ranked lists of albums and songs, follow other collectors, and build the community chart.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  for (const host of COVER_HOSTS) {
    preconnect(host);
    prefetchDNS(host); // dns-prefetch fallback for browsers that skip preconnect
  }
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Nav />
        <VUScroll />
        {/* Content scrolls under the fixed glass bars — pad, don't reserve. */}
        <main className="w-full flex-1 pt-[calc(56px+env(safe-area-inset-top))] pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-8">
          {children}
        </main>
        <footer className="border-t border-hairline px-5 py-4 pb-[calc(16px+96px+env(safe-area-inset-bottom))] text-center font-mono text-[10px] uppercase tracking-[0.16em] text-secondary md:pb-4">
          Ordko · community charts pressed from published lists
        </footer>
      </body>
    </html>
  );
}
