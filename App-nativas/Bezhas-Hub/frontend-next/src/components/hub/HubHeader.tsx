'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { LINKS } from '../../config/hubData';

const NAV = [
  { href: '/', label: 'Inicio' },
  { href: '/apps', label: 'Apps nativas' },
  { href: '/planes', label: 'Planes' },
  { href: '/developers', label: 'Developers' },
];

export default function HubHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const toggleTheme = () => {
    const el = document.documentElement;
    const next = el.getAttribute('data-bz-theme') === 'dark' ? 'light' : 'dark';
    el.setAttribute('data-bz-theme', next);
    try { localStorage.setItem('bz-theme', next); } catch { /* sin almacenamiento: el tema vale para esta visita */ }
  };

  return (
    <header className="hub-header">
      <div className="hub-wrap hub-header-in">
        <Link href="/" className="hub-logo" aria-label="BeZhas Hub, inicio">
          <span className="hub-logo-mark">B</span>
          <span>BeZhas <small>Hub</small></span>
        </Link>
        <nav className="hub-nav" data-open={open ? '1' : '0'} aria-label="Principal">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={path === n.href ? 'page' : undefined} onClick={() => setOpen(false)}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hub-header-end">
          <button className="hub-icon-btn" onClick={toggleTheme} aria-label="Cambiar tema claro u oscuro">
            <Sun size={18} className="hub-sun" /><Moon size={18} className="hub-moon" />
          </button>
          <a className="hub-btn hub-btn-primary hub-header-cta" href={LINKS.precios}>Contratar</a>
          <button className="hub-icon-btn hub-burger" onClick={() => setOpen((v) => !v)} aria-label="Abrir menú" aria-expanded={open}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}
