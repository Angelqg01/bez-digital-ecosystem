'use client';

import { ExternalLink } from 'lucide-react';
import { SUBAPPS, SubappKey, subappUrl } from '../../config/subapps';

type Props = {
  appKey: SubappKey;
  path?: string;
  title: string;
  reason: string;
};

export default function SubappRedirectPage({ appKey, path = '', title, reason }: Props) {
  const app = SUBAPPS[appKey];
  const targetUrl = subappUrl(appKey, path);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl flex-col justify-center px-6 py-24">
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-600 dark:text-cyan-400">
          Control Plane
        </p>
        <h1 className="mt-4 text-3xl font-black text-slate-950 dark:text-white">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{reason}</p>

        <div className="mt-6 rounded-lg bg-slate-50 p-4 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Owner operativo</p>
          <p className="mt-1 text-lg font-bold text-slate-950 dark:text-white">{app.name}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{app.owns.join(' / ')}</p>
        </div>

        <a
          href={targetUrl}
          className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-5 text-sm font-bold uppercase tracking-widest text-white hover:bg-cyan-500"
        >
          Abrir {app.name}
          <ExternalLink size={16} />
        </a>
      </div>
    </main>
  );
}
