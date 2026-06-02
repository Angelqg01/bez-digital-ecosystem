import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutGrid,
  Wallet,
  Fuel,
  Server,
  Eye,
  LineChart,
  Crown,
  Ship,
  Droplets,
  ShieldCheck,
  Globe2,
  Cpu,
  Coins,
  ExternalLink
} from 'lucide-react';

const apps = [
  {
    id: 'hub',
    name: 'BeZhas Hub',
    url: 'https://bez.digital/dashboard',
    icon: <LayoutGrid size={24} />,
    color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    description: 'SSO y consola central'
  },
  {
    id: 'wallet',
    name: 'BeZhas Wallet',
    url: 'https://bez.digital/dashboard/wallet',
    icon: <Wallet size={24} />,
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    description: 'Pagos y gobernanza'
  },
  {
    id: 'gas',
    name: 'Gas Tank',
    url: 'https://bez.digital/dashboard/gas',
    icon: <Fuel size={24} />,
    color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    description: 'Gestión de gas fee'
  },
  {
    id: 'nodes',
    name: 'Edge Nodes',
    url: 'https://bez.digital/dashboard/validators',
    icon: <Server size={24} />,
    color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    description: 'DePIN y recursos'
  },
  {
    id: 'vision',
    name: 'Vision Scan',
    url: 'https://bez.digital/dashboard/qr',
    icon: <Eye size={24} />,
    color: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
    description: 'IA y escaneo'
  },
  {
    id: 'capital',
    name: 'BZ Capital',
    url: 'https://bez.digital/dashboard/farming',
    icon: <LineChart size={24} />,
    color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    description: 'DeFi y Staking'
  },
  {
    id: 'prestige',
    name: 'BZ Prestige',
    url: 'https://bez.digital/dashboard/nfts',
    icon: <Crown size={24} />,
    color: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    description: 'Luxury DPP y royalties'
  },
  {
    id: 'cargo',
    name: 'BZ CargoLink',
    url: 'https://bez.digital/dashboard/sectors',
    icon: <Ship size={24} />,
    color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
    description: 'Logística y manifiestos'
  },
  {
    id: 'energy',
    name: 'BEZ Energy',
    url: 'https://bez.digital/enterprise',
    icon: <Droplets size={24} />,
    color: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
    description: 'Energía tokenizada'
  },
  {
    id: 'purescan',
    name: 'BZ PureScan',
    url: 'https://bez.digital/dashboard/qr',
    icon: <ShieldCheck size={24} />,
    color: 'bg-lime-100 text-lime-600 dark:bg-lime-900/30 dark:text-lime-400',
    description: 'Certificación y auditoría'
  },
  {
    id: 'sphere',
    name: 'BZ Sphere',
    url: 'https://bez.digital/solutions',
    icon: <Globe2 size={24} />,
    color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    description: 'Mapa operativo global'
  },
  {
    id: 'genesis',
    name: 'BZ Genesis',
    url: 'https://bez.digital/dashboard',
    icon: <Cpu size={24} />,
    color: 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-400',
    description: 'Onboarding de proyectos'
  },
  {
    id: 'pay',
    name: 'Pay Manager',
    url: 'https://bez.digital/payments',
    icon: <Coins size={24} />,
    color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    description: 'Cobros y monetización'
  }
];

export default function AppSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const getAppUrl = (app) => {
    if (typeof window === 'undefined') return app.url;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      return app.url;
    }
    // Mapeo de producción para bez.digital
    const prodPaths = {
      'hub': '/dashboard',
      'wallet': '/dashboard/wallet',
      'gas': '/dashboard/gas',
      'nodes': '/dashboard/validators',
      'vision': '/dashboard/qr',
      'capital': '/dashboard/farming',
      'prestige': '/dashboard/nfts',
      'cargo': '/dashboard/sectors',
      'energy': '/enterprise',
      'purescan': '/dashboard/qr',
      'sphere': '/solutions',
      'genesis': '/dashboard',
      'pay': '/payments'
    };
    return prodPaths[app.id] || `/${app.id}`;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-gray-500 dark:text-gray-400"
        title="BeZhas Apps"
      >
        <LayoutGrid size={24} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 p-4 animate-fadeIn">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white">BeZhas Apps</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {apps.map((app) => (
              <a
                key={app.id}
                href={getAppUrl(app)}
                target="_self"
                className="flex flex-col items-center justify-center p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group text-center border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
              >
                <div className={`p-3 rounded-full mb-2 transition-transform group-hover:scale-110 ${app.color}`}>
                  {app.icon}
                </div>
                <span className="font-semibold text-sm text-gray-800 dark:text-gray-200 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                  {app.name}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                  {app.description}
                </span>
              </a>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-center">
            <a href="https://bez.digital" target="_blank" rel="noopener noreferrer" className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 font-medium flex items-center justify-center gap-1">
              Ver ecosistema completo <ExternalLink size={14} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
