'use client';

import { useState, useRef, type KeyboardEvent } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { NAV } from '@/lib/site';

export function MainNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  function closeOnEscape(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && open) {
      setOpen(false);
      trigger.current?.focus();
    }
  }
  return (
    <nav aria-label="Main" className="site-nav">
      <button
        onKeyDown={closeOnEscape}
        ref={trigger}
        type="button"
        className="site-menu-toggle"
        aria-expanded={open}
        aria-controls="main-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        {open ? 'Close' : 'Menu'}
      </button>
      <ul id="main-navigation" className={open ? 'is-open' : undefined}>
        {NAV.map((n) => (
          <li key={n.href}>
            <a
              href={n.href}
              aria-current={path === n.href ? 'page' : undefined}
              onKeyDown={closeOnEscape}
              onClick={() => setOpen(false)}
            >
              {n.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
