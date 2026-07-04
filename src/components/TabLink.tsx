'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Mobile tab-bar item — active route renders cobalt (the interactive color). */
export function TabLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
  return (
    <Link
      href={href as '/'}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`press flex min-h-[48px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-card px-2.5 font-mono text-[9px] uppercase tracking-[0.1em] ${
        active ? 'text-cobalt' : 'text-secondary'
      }`}
    >
      {children}
      <span>{label}</span>
    </Link>
  );
}
