import type { Metadata, Viewport } from 'next';
import { Archivo_Black, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { Nav } from '@/components/Nav';
import { VUScroll } from '@/components/VUScroll';
import './globals.css';

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
