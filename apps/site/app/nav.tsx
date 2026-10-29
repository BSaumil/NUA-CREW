'use client';

import { usePathname } from 'next/navigation';
import { NAV } from '@/lib/site';

export function MainNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="site-nav">
      <ul>
        {NAV.map((n) => (
          <li key={n.href}>
            <a href={n.href} aria-current={path === n.href ? 'page' : undefined}>
              {n.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
