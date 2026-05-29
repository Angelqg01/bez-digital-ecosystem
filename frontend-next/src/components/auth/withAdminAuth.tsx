'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useUserStore } from '@/stores/userStore';

const ADMIN_ROLES = new Set(['admin', 'super_admin', 'developer', 'devops', 'security']);

export function withAdminAuth<P extends object>(Component: ComponentType<P>) {
  return function AdminGuard(props: P) {
    const { user, isAuthenticated, token } = useUserStore();
    const role = String(user?.role || '').toLowerCase();
    const isAdmin = ADMIN_ROLES.has(role) || Boolean(token);

    if (!isAuthenticated && !token) {
      return (
        <main className="min-h-screen bg-[#0A0E1A] px-6 py-24 text-[var(--bez-text)]">
          <div className="mx-auto max-w-xl rounded-lg border border-[#00D4FF]/25 bg-[var(--bez-card)] p-8 text-center">
            <ShieldAlert className="mx-auto text-[#00D4FF]" size={36} />
            <h1 className="mt-5 text-2xl font-black">Acceso administrativo requerido</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--bez-text2)]">
              Inicia sesion con una cuenta autorizada de BeZhas para crear o editar noticias del Magazine.
            </p>
            <Link href="/auth" className="mt-6 inline-flex h-11 items-center rounded-lg bg-[#00D4FF] px-5 text-sm font-black text-[#06111d]">
              Ir a autenticacion
            </Link>
          </div>
        </main>
      );
    }

    if (!isAdmin) {
      return (
        <main className="min-h-screen bg-[#0A0E1A] px-6 py-24 text-[var(--bez-text)]">
          <div className="mx-auto max-w-xl rounded-lg border border-[#7B2FFF]/35 bg-[var(--bez-card)] p-8 text-center">
            <ShieldAlert className="mx-auto text-[#C7B7FF]" size={36} />
            <h1 className="mt-5 text-2xl font-black">Rol insuficiente</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--bez-text2)]">
              Esta ruta esta protegida para el Departamento de Marketing, admin o developer.
            </p>
          </div>
        </main>
      );
    }

    return <Component {...props} />;
  };
}
