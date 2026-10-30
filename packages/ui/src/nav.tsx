import { BrandLockup } from './brand';

export type NavItem = { href: string; label: string; key: string };

function Nav({ items, current, label }: { items: NavItem[]; current: string; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="nua-nav">
        {items.map((i) => (
          <li key={i.key}>
            <a href={i.href} aria-current={i.key === current ? 'page' : undefined}>
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export const CANDIDATE_NAV: NavItem[] = [
  { key: 'dashboard', href: '/dashboard', label: 'Overview' },
  { key: 'discover', href: '/jobs', label: 'Discover' },
  { key: 'applications', href: '/applications', label: 'Applications' },
  { key: 'profile', href: '/profile', label: 'Profile' },
  { key: 'shifts', href: '/shifts', label: 'Shifts' },
  { key: 'notifications', href: '/notifications', label: 'Updates' },
];

export function CandidateNav({
  current,
  right,
  items = CANDIDATE_NAV,
}: {
  current: string;
  right?: React.ReactNode;
  items?: NavItem[];
}) {
  return (
    <header className="nua-header">
      <div className="nua-container nua-header__inner">
        <BrandLockup />
        <Nav items={items} current={current} label="Main" />
        <div className="nua-row">{right}</div>
      </div>
    </header>
  );
}

export const EMPLOYER_NAV: NavItem[] = [
  { key: 'jobs', href: '/', label: 'Jobs' },
  { key: 'talent', href: '/talent', label: 'Find talent' },
  { key: 'invitations', href: '/invitations', label: 'Invitations' },
  { key: 'messages', href: '/messages', label: 'Messages' },
  { key: 'team', href: '/team', label: 'Team' },
  { key: 'shifts', href: '/shifts', label: 'Shifts & hours' },
  { key: 'notifications', href: '/notifications', label: 'Updates' },
  { key: 'billing', href: '/billing', label: 'Advertising & billing' },
];

export function EmployerSidebar({
  current,
  items = EMPLOYER_NAV,
}: {
  current: string;
  items?: NavItem[];
}) {
  return (
    <aside className="nua-sidebar">
      <Nav items={items} current={current} label="Hire navigation" />
    </aside>
  );
}

export function EmployerHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="nua-header">
      <div className="nua-container nua-header__inner">
        <span className="nua-row">
          <BrandLockup />
          <span className="nua-badge">NUA CREW Hire</span>
        </span>
        <div className="nua-row">{right}</div>
      </div>
    </header>
  );
}
