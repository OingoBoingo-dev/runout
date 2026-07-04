import type { Metadata } from 'next';
import { Archivo_Black, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { Nav } from '@/components/Nav';
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
  title: { default: 'Runout — ranked lists for record obsessives', template: '%s — Runout' },
  description:
    'Publish ranked lists of albums and songs, follow other collectors, and build the community chart.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="flex-1 w-full">{children}</main>
        <footer className="border-t border-paper/15 px-5 py-4 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          Runout · community charts pressed from published lists · RNT-002 / Side B
        </footer>
      </body>
    </html>
  );
}
