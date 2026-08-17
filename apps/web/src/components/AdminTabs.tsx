'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin', label: 'Vetting review' },
  { href: '/admin/settings', label: 'Platform settings' },
];

/** Top-level admin section switcher (Vetting vs the settings CRM). */
export function AdminTabs() {
  const pathname = usePathname();
  return (
    <div className="tabs" style={{ margin: '1rem 0' }}>
      {TABS.map((t) => {
        const active =
          t.href === '/admin'
            ? pathname === '/admin'
            : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link key={t.href} href={t.href} data-active={active}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
