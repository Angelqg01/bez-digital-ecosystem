import { ArrowRight } from 'lucide-react';
import { ECOSYSTEM_APPS } from '../../data/landing';

type EcosystemAppsSectionProps = {
  onHover?: () => void;
  onClick?: () => void;
};

export default function EcosystemAppsSection({ onHover, onClick }: EcosystemAppsSectionProps) {
  return (
    <div id="apps" className="mt-20 reveal lg:col-span-2">
      <div className="flex items-center gap-4 mb-8">
        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-gray-600" />
        <span className="text-gray-400 text-sm font-bold uppercase tracking-widest px-4 border border-gray-600 rounded-full bg-white/5 py-1">
          Las App's del Ecosistema BeZhas
        </span>
        <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-gray-600" />
      </div>

      <div className="mb-8 text-center max-w-3xl mx-auto">
        <p className="text-gray-400 text-sm md:text-base leading-relaxed">
          Acceso directo a los módulos SSO, DePIN, DeFi, RWA, pagos, IA y trazabilidad que componen la plataforma BeZhas.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {ECOSYSTEM_APPS.map((app) => {
          const Icon = app.icon;

          return (
            <a
              key={app.name}
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={onHover}
              onClick={onClick}
              className="group bg-[#080911]/60 backdrop-blur-md p-5 rounded-xl border border-gray-800 hover:border-white/30 transition-all overflow-hidden relative flex flex-col min-h-[210px]"
            >
              <div className={`w-11 h-11 rounded-xl border flex items-center justify-center mb-4 transition-transform group-hover:scale-105 ${app.accent}`}>
                <Icon className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white mb-2 uppercase tracking-widest">{app.name}</h4>
              <p className="text-gray-400 text-xs leading-relaxed flex-grow">{app.description}</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className={`text-[10px] font-mono px-2 py-1 rounded border ${app.accent}`}>
                  PORT {app.port}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-white transition-colors flex items-center gap-1">
                  Abrir <ArrowRight size={12} />
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
