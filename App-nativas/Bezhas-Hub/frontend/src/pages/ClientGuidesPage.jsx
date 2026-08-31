import React, { useState } from 'react';
import {
  FileText, Code, Globe, BookOpen, ExternalLink,
  CheckCircle, Terminal, Plug, HelpCircle, Play,
  ArrowRight, Download, Copy, Check, Compass,
  Key, Shield, Webhook, Box, ChevronRight,
  Clock, Zap, Layers, GraduationCap, ListChecks,
  Server, Smartphone, Cloud,
} from 'lucide-react';

const TABS = [
  { id: 'quickstart', label: 'Guía de Inicio', icon: <Compass size={18} /> },
  { id: 'overview', label: 'Visión General', icon: <BookOpen size={18} /> },
  { id: 'api', label: 'API REST', icon: <Terminal size={18} /> },
  { id: 'sdk', label: 'SDK JavaScript', icon: <Code size={18} /> },
  { id: 'wordpress', label: 'Plugin WordPress', icon: <Plug size={18} /> },
  { id: 'faq', label: 'FAQ', icon: <HelpCircle size={18} /> },
  { id: 'videos', label: 'Vídeo Tutoriales', icon: <Play size={18} /> },
];

function CopyBlock({ code, lang = 'bash' }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <pre className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-sm text-yellow-300 font-mono overflow-x-auto">
        {code}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copiar"
      >
        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function StepCard({ number, title, children }) {
  return (
    <div className="flex gap-4 mb-6">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white font-bold text-lg">
        {number}
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <div className="text-gray-300 space-y-3">{children}</div>
      </div>
    </div>
  );
}

function QuickStartTab({ onNavigate }) {
  const LEARNING_PATHS = [
    {
      color: 'from-pink-500 to-pink-700',
      border: 'border-pink-500/30',
      badge: 'Sin Código',
      badgeBg: 'bg-pink-500/20 text-pink-300',
      icon: <Plug size={20} className="text-pink-400" />,
      title: 'Ruta WordPress',
      time: '5 minutos',
      audience: 'Dueños de tiendas online',
      steps: [
        'Descargar plugin de hub.bez.digital/downloads',
        'Instalar en WordPress Admin',
        'Pegar API Key en ajustes',
        '¡Listo! Ya aceptas pagos con BeZhas',
      ],
      action: 'wordpress',
      actionLabel: 'Ir a Guía WordPress',
    },
    {
      color: 'from-teal-500 to-teal-700',
      border: 'border-teal-500/30',
      badge: 'Rápido',
      badgeBg: 'bg-teal-500/20 text-teal-300',
      icon: <Code size={20} className="text-teal-400" />,
      title: 'Ruta SDK JavaScript',
      time: '30 min — 1 hora',
      audience: 'Desarrolladores JS / React / Node.js',
      steps: [
        'pnpm add @bezhas/connect',
        'Inicializar SDK con API Key',
        'Usar bezhas.pay.buy() o bezhas.cargolink.createTx()',
        'Verificar webhooks y deploy',
      ],
      action: 'sdk',
      actionLabel: 'Ir a Guía SDK',
    },
    {
      color: 'from-blue-500 to-blue-700',
      border: 'border-blue-500/30',
      badge: 'Control Total',
      badgeBg: 'bg-blue-500/20 text-blue-300',
      icon: <Terminal size={20} className="text-blue-400" />,
      title: 'Ruta API REST',
      time: '2 — 4 horas',
      audience: 'Backend: Node, Python, Java, Go, PHP...',
      steps: [
        'Obtener API Key en hub.bez.digital/developers',
        'Primera llamada: GET /health',
        'Implementar endpoints (pay, cargolink, etc.)',
        'Registrar webhooks y testing sandbox',
        'Monitorear logs y deploy a producción',
      ],
      action: 'api',
      actionLabel: 'Ir a Guía API',
    },
    {
      color: 'from-yellow-500 to-yellow-700',
      border: 'border-yellow-500/30',
      badge: 'Custom',
      badgeBg: 'bg-yellow-500/20 text-yellow-300',
      icon: <Layers size={20} className="text-yellow-400" />,
      title: 'Ruta Caso Específico',
      time: 'Variable',
      audience: 'Integraciones a medida / multi-método',
      steps: [
        'Lee la Visión General para contexto',
        'Busca tu caso en los ejemplos de cada guía',
        'Adapta el código a tu stack',
        'Consulta FAQ si hay errores',
      ],
      action: 'overview',
      actionLabel: 'Ver Visión General',
    },
  ];

  const KEY_CONCEPTS = [
    {
      icon: <Key size={18} className="text-yellow-400" />,
      title: 'API Key',
      desc: 'Tu credencial para acceder a BeZhas desde el backend.',
      details: [
        'Generar en: hub.bez.digital/developers',
        'Header: x-api-key: bez_key_xxx',
        'Nunca incluir en commits de código',
      ],
    },
    {
      icon: <Shield size={18} className="text-teal-400" />,
      title: 'JWT (JSON Web Token)',
      desc: 'Token que recibe el usuario tras hacer login.',
      details: [
        'Login: /auth/siwe o /auth/email',
        'Válido: 24 horas (refresh 30 días)',
        'Header: Authorization: Bearer <token>',
      ],
    },
    {
      icon: <Webhook size={18} className="text-purple-400" />,
      title: 'Webhook',
      desc: 'Notificación automática de BeZhas a tu servidor.',
      details: [
        'Eventos: payment.completed, cargo.delivered...',
        'Verificar firma HMAC-SHA256 siempre',
        'Responder en < 5 segundos',
      ],
    },
    {
      icon: <Box size={18} className="text-pink-400" />,
      title: 'SubApp',
      desc: 'Aplicación especializada dentro del ecosistema.',
      details: [
        '13 SubApps: Pay, CargoLink, Capital, Energy...',
        'Acceso vía: URL directa, API o SDK',
        'Activa solo las que necesites',
      ],
    },
  ];

  const SUPPORTED_STACK = {
    languages: [
      'JavaScript / TypeScript', 'Python 3.8+', 'Java 11+', 'C# .NET 6+',
      'Go 1.16+', 'PHP 7.4+', 'Ruby 2.7+', 'Rust', 'Cualquier otro (HTTP)',
    ],
    frameworks: [
      'React, Vue, Angular', 'Express, Fastify', 'Django, FastAPI',
      'Laravel, Symfony', 'Spring, Quarkus', 'ASP.NET', 'Gin, Echo',
    ],
    platforms: [
      'AWS Lambda, Google Cloud, Azure',
      'Vercel, Netlify, Cloudflare',
      'Docker / Kubernetes',
      'On-premise (VPS, dedicado)',
    ],
  };

  const CHECKLIST = [
    'API Key guardada en .env (no en código)',
    'Webhook signature verificada (HMAC-SHA256)',
    'HTTPS en tu webhook URL',
    'Testing en sandbox completado',
    'Rate limiting implementado (1000 req/min)',
    'Logs y monitoring activos',
    'Keys rotadas (diferentes para dev/prod)',
    'Equipo entrenado en la documentación',
  ];

  const [checkedItems, setCheckedItems] = useState({});

  return (
    <div className="space-y-10">

      {/* Hero: ¿Por dónde empiezo? */}
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-teal-500/30 rounded-2xl p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-teal-500/10 border border-teal-500/30 rounded-full text-teal-400 text-sm font-medium mb-4">
            <Compass size={16} /> Punto de Partida
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">¿Por Dónde Empiezo?</h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Responde una pregunta y te llevamos directamente a la guía que necesitas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { q: '¿Tienes una tienda en WordPress / WooCommerce?', target: 'wordpress', icon: <Plug size={16} />, color: 'text-pink-400 border-pink-500/40 hover:bg-pink-500/10' },
            { q: '¿Estás construyendo una app o sitio web custom?', target: 'sdk', icon: <Code size={16} />, color: 'text-teal-400 border-teal-500/40 hover:bg-teal-500/10' },
            { q: '¿Necesitas máximo control desde tu backend?', target: 'api', icon: <Terminal size={16} />, color: 'text-blue-400 border-blue-500/40 hover:bg-blue-500/10' },
            { q: '¿Tienes un caso de uso específico o mixto?', target: 'overview', icon: <Layers size={16} />, color: 'text-yellow-400 border-yellow-500/40 hover:bg-yellow-500/10' },
          ].map((item) => (
            <button
              key={item.target}
              onClick={() => onNavigate(item.target)}
              className={`flex items-center gap-3 p-4 rounded-xl border bg-gray-900/50 transition-all text-left ${item.color}`}
            >
              {item.icon}
              <span className="text-gray-200 text-sm flex-1">{item.q}</span>
              <ChevronRight size={16} className="opacity-50" />
            </button>
          ))}
        </div>
      </div>

      {/* Rutas de Aprendizaje */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <GraduationCap size={22} className="text-teal-400" />
          <h2 className="text-xl font-bold text-white">Rutas de Aprendizaje</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {LEARNING_PATHS.map((path) => (
            <div
              key={path.title}
              className={`bg-gray-800/50 border ${path.border} rounded-xl p-6 flex flex-col`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {path.icon}
                  <h3 className="text-white font-semibold">{path.title}</h3>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${path.badgeBg}`}>
                  {path.badge}
                </span>
              </div>

              <div className="flex gap-4 text-xs text-gray-500 mb-4">
                <span className="flex items-center gap-1"><Clock size={12} /> {path.time}</span>
                <span className="flex items-center gap-1"><Smartphone size={12} /> {path.audience}</span>
              </div>

              <ol className="space-y-2 mb-5 flex-1">
                {path.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br ${path.color} flex items-center justify-center text-white text-[10px] font-bold mt-0.5`}>
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              <button
                onClick={() => onNavigate(path.action)}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r ${path.color} text-white text-sm font-medium hover:opacity-90 transition-opacity`}
              >
                {path.actionLabel} <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla Comparativa */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Layers size={22} className="text-teal-400" />
          <h2 className="text-xl font-bold text-white">Comparación de Métodos</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Aspecto</th>
                <th className="text-center py-3 px-4 text-pink-400 font-medium">Plugin WP</th>
                <th className="text-center py-3 px-4 text-teal-400 font-medium">SDK JS</th>
                <th className="text-center py-3 px-4 text-blue-400 font-medium">API REST</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {[
                ['Tiempo de Setup', '5 min', '30 min', '2-4 horas'],
                ['Complejidad', 'Muy baja', 'Baja', 'Media'],
                ['Funcionalidades', 'Pagos', 'Pagos + Cargo', 'Todo'],
                ['Stack requerido', 'PHP', 'JS / TS', 'Cualquiera'],
                ['Ideal para', 'Tiendas', 'SPA / Apps', 'Backends'],
                ['Costo', 'Gratis', 'Incluido', 'Pay-per-call'],
                ['Webhooks', 'Auto', 'SDK helper', 'Manual'],
                ['Personalización', 'Limitada', 'Alta', 'Total'],
              ].map(([label, wp, sdk, api], i) => (
                <tr key={i} className={`border-b border-gray-800 ${i % 2 === 0 ? 'bg-gray-800/20' : ''}`}>
                  <td className="py-3 px-4 text-white font-medium">{label}</td>
                  <td className="py-3 px-4 text-center">{wp}</td>
                  <td className="py-3 px-4 text-center">{sdk}</td>
                  <td className="py-3 px-4 text-center">{api}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conceptos Clave */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Key size={22} className="text-teal-400" />
          <h2 className="text-xl font-bold text-white">Conceptos Clave</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {KEY_CONCEPTS.map((concept) => (
            <div key={concept.title} className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                {concept.icon}
                <h3 className="text-white font-semibold">{concept.title}</h3>
              </div>
              <p className="text-gray-400 text-sm mb-3">{concept.desc}</p>
              <ul className="space-y-1.5">
                {concept.details.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                    <CheckCircle size={12} className="text-teal-500 mt-0.5 flex-shrink-0" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Stack Soportado */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Server size={22} className="text-teal-400" />
          <h2 className="text-xl font-bold text-white">Stack Técnico Soportado</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { title: 'Lenguajes', icon: <Code size={16} className="text-blue-400" />, items: SUPPORTED_STACK.languages },
            { title: 'Frameworks', icon: <Layers size={16} className="text-teal-400" />, items: SUPPORTED_STACK.frameworks },
            { title: 'Plataformas', icon: <Cloud size={16} className="text-purple-400" />, items: SUPPORTED_STACK.platforms },
          ].map((group) => (
            <div key={group.title} className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                {group.icon}
                <h3 className="text-white font-semibold text-sm">{group.title}</h3>
              </div>
              <ul className="space-y-2">
                {group.items.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Checklist Pre-Producción */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <ListChecks size={22} className="text-teal-400" />
          <h2 className="text-xl font-bold text-white">Checklist: Listo para Producción</h2>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <p className="text-gray-400 text-sm mb-5">
            Marca cada punto antes de pasar tu integración a producción.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CHECKLIST.map((item, i) => (
              <label
                key={i}
                className="flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-gray-700/30 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={!!checkedItems[i]}
                  onChange={() => setCheckedItems((prev) => ({ ...prev, [i]: !prev[i] }))}
                  className="mt-0.5 w-4 h-4 rounded border-gray-600 text-teal-500 focus:ring-teal-500 focus:ring-offset-0 bg-gray-700 cursor-pointer"
                />
                <span className={`text-sm transition-colors ${checkedItems[i] ? 'text-teal-400 line-through' : 'text-gray-300'}`}>
                  {item}
                </span>
              </label>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-gray-700 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {Object.values(checkedItems).filter(Boolean).length} / {CHECKLIST.length} completados
            </span>
            {Object.values(checkedItems).filter(Boolean).length === CHECKLIST.length && (
              <span className="text-xs text-teal-400 font-medium flex items-center gap-1">
                <CheckCircle size={14} /> Listo para producción
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Roadmap */}
      <div className="bg-gradient-to-br from-teal-900/20 to-gray-900/50 border border-teal-500/20 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Zap size={20} className="text-yellow-400" /> Roadmap de Aprendizaje (5 días)
        </h3>
        <div className="flex flex-col md:flex-row gap-2">
          {[
            { day: 'Día 1', task: 'Elige tu ruta y lee la guía', color: 'bg-teal-500' },
            { day: 'Día 2', task: 'Implementa con los ejemplos', color: 'bg-blue-500' },
            { day: 'Día 3', task: 'Testing en sandbox', color: 'bg-purple-500' },
            { day: 'Día 4', task: 'Resuelve dudas con FAQ', color: 'bg-yellow-500' },
            { day: 'Día 5', task: 'Deploy a producción', color: 'bg-pink-500' },
          ].map((d, i) => (
            <div key={i} className="flex-1 flex items-center gap-3 bg-gray-800/50 rounded-lg p-3">
              <div className={`w-2 h-8 rounded-full ${d.color}`} />
              <div>
                <p className="text-white text-xs font-bold">{d.day}</p>
                <p className="text-gray-400 text-xs">{d.task}</p>
              </div>
              {i < 4 && <ArrowRight size={12} className="text-gray-600 hidden md:block ml-auto" />}
            </div>
          ))}
        </div>
      </div>

      {/* Soporte */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6 text-center">
        <h3 className="text-white font-semibold mb-3">¿Necesitas ayuda?</h3>
        <div className="flex flex-wrap justify-center gap-4 text-sm">
          <span className="text-gray-300">
            <span className="text-teal-400 font-medium">Email:</span> support@bez.digital (&lt;2h)
          </span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-300">
            <span className="text-teal-400 font-medium">Chat:</span> hub.bez.digital/chat (&lt;30min)
          </span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-300">
            <span className="text-teal-400 font-medium">Docs:</span> hub.bez.digital/docs (24/7)
          </span>
        </div>
        <p className="text-gray-500 text-xs mt-3">
          También puedes usar el chatbot de IA en la esquina inferior derecha (Ctrl+K)
        </p>
      </div>
    </div>
  );
}

function OverviewTab() {
  const methods = [
    {
      title: 'API REST',
      difficulty: 'Media',
      time: '2-4 horas',
      color: 'from-blue-500 to-blue-700',
      features: ['Control total', 'Multi-lenguaje', 'Webhooks', 'Batch processing'],
      ideal: 'Backend integration, automatización, ERP',
    },
    {
      title: 'SDK JavaScript',
      difficulty: 'Baja',
      time: '30 minutos',
      color: 'from-teal-500 to-teal-700',
      features: ['Zero-deps', 'Async/await', 'Type-safe', 'Browser-safe'],
      ideal: 'Frontend React/Vue, Node.js, serverless',
    },
    {
      title: 'Plugin WordPress',
      difficulty: 'Muy Baja',
      time: '5 minutos',
      color: 'from-pink-500 to-pink-700',
      features: ['Sin código', 'Dashboard widget', 'Auto-sync', 'WooCommerce'],
      ideal: 'Tiendas online, ecommerce',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">3 Formas de Integrar BeZhas</h2>
        <p className="text-gray-400">Elige la que mejor se adapta a tu plataforma</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {methods.map((m) => (
          <div key={m.title} className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-teal-500/50 transition-all">
            <div className={`inline-block px-3 py-1 rounded-full bg-gradient-to-r ${m.color} text-white text-sm font-bold mb-4`}>
              {m.title}
            </div>
            <div className="flex justify-between text-sm text-gray-400 mb-4">
              <span>Dificultad: <span className="text-teal-400">{m.difficulty}</span></span>
              <span>Setup: <span className="text-yellow-400">{m.time}</span></span>
            </div>
            <ul className="space-y-2 mb-4">
              {m.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-gray-300 text-sm">
                  <CheckCircle size={14} className="text-teal-400 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500">Ideal para: {m.ideal}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">13 SubApps Disponibles</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: 'CargoLink', desc: 'Logística', icon: '📦' },
            { name: 'BeZhas Pay', desc: 'Pagos', icon: '💳' },
            { name: 'BZ Capital', desc: 'DeFi', icon: '💎' },
            { name: 'BEZ Wallet', desc: 'Activos', icon: '🔐' },
            { name: 'BZ Energy', desc: 'VPP', icon: '⚡' },
            { name: 'BZ Genesis', desc: 'Identidad', icon: '🧬' },
            { name: 'BZ Prestige', desc: 'Club B2B', icon: '👑' },
            { name: 'BZ Sphere', desc: 'Social', icon: '🌐' },
            { name: 'PureScan', desc: 'Compliance', icon: '🔍' },
            { name: 'Vision Scan', desc: 'IA Visual', icon: '👁️' },
            { name: 'Gas Tank', desc: 'Gas fees', icon: '⛽' },
            { name: 'Edge Node', desc: 'DePIN', icon: '🖥️' },
            { name: 'RWA', desc: 'Inmobiliaria', icon: '🏢' },
          ].map((app) => (
            <div key={app.name} className="bg-gray-900/50 rounded-lg p-3 flex items-center gap-3">
              <span className="text-xl">{app.icon}</span>
              <div>
                <p className="text-white text-sm font-medium">{app.name}</p>
                <p className="text-gray-500 text-xs">{app.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ApiTab() {
  return (
    <div className="space-y-6">
      <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 mb-6">
        <p className="text-blue-300 text-sm">
          <strong>Base URL:</strong> <code className="bg-gray-800 px-2 py-0.5 rounded">https://api.bez.digital:3001</code> &nbsp;|&nbsp;
          <strong>Auth:</strong> <code className="bg-gray-800 px-2 py-0.5 rounded">x-api-key: bez_key_xxx</code>
        </p>
      </div>

      <StepCard number={1} title="Obtener API Key">
        <p>Ve al panel de desarrolladores y genera tu clave.</p>
        <CopyBlock code={`# Guardar en .env (nunca en código)\nBEZHAS_API_KEY=bez_key_xxxxxxxxxxxxxxxx\nBEZHAS_API_URL=https://api.bez.digital:3001\nBEZHAS_WEBHOOK_SECRET=wh_secret_yyyyyyyyyyy`} />
      </StepCard>

      <StepCard number={2} title="Primera Llamada">
        <p>Verifica la conexión con el endpoint de salud.</p>
        <CopyBlock code={`curl -H "x-api-key: $BEZHAS_API_KEY" \\\n  https://api.bez.digital:3001/health\n\n# Response: { "status": "ok", "uptime": 12345, ... }`} />
      </StepCard>

      <StepCard number={3} title="Usar Endpoints de SubApps">
        <CopyBlock code={`# Crear pago\ncurl -X POST \\\n  -H "x-api-key: $BEZHAS_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"amountUSD":100,"paymentMethod":"card","email":"client@example.com"}' \\\n  https://api.bez.digital:3001/api/gateway/v1/pay\n\n# Crear transacción logística\ncurl -X POST \\\n  -H "x-api-key: $BEZHAS_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"posRef":"ORD-1001","origin":"Algeciras","destination":"Tánger"}' \\\n  https://api.bez.digital:3001/api/cargolink/transactions`} />
      </StepCard>

      <StepCard number={4} title="Configurar Webhooks">
        <p>Recibe eventos de BeZhas en tu servidor. Verifica siempre la firma HMAC-SHA256.</p>
        <CopyBlock code={`const crypto = require('crypto');\n\napp.post('/webhooks/bezhas', express.raw({type:'application/json'}), (req, res) => {\n  const sig = req.headers['x-bezhas-signature'];\n  const hash = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET)\n    .update(req.body).digest('hex');\n\n  if (hash !== sig) return res.status(401).json({ error: 'Invalid' });\n\n  const data = JSON.parse(req.body);\n  // Procesar evento: data.event, data.data\n  res.json({ ack: true });\n});`} />
      </StepCard>

      <StepCard number={5} title="¡Producción!">
        <div className="bg-teal-900/20 border border-teal-700/40 rounded-lg p-4">
          <p className="text-teal-300 text-sm">
            ✅ Rate limit: 1000 req/min &nbsp;|&nbsp; ✅ Monitoring en <code>/admin/logs</code> &nbsp;|&nbsp; ✅ Soporte: support@bez.digital
          </p>
        </div>
      </StepCard>
    </div>
  );
}

function SdkTab() {
  return (
    <div className="space-y-6">
      <div className="bg-teal-900/20 border border-teal-800/40 rounded-xl p-4 mb-6">
        <p className="text-teal-300 text-sm">
          <strong>Paquete:</strong> <code className="bg-gray-800 px-2 py-0.5 rounded">@bezhas/connect</code> &nbsp;|&nbsp;
          <strong>Dependencias:</strong> <span className="text-yellow-300">Zero</span> &nbsp;|&nbsp;
          <strong>Runtime:</strong> Node.js 18+ &amp; browsers
        </p>
      </div>

      <StepCard number={1} title="Instalar">
        <CopyBlock code={`pnpm add @bezhas/connect\n# o: npm install @bezhas/connect`} />
      </StepCard>

      <StepCard number={2} title="Inicializar">
        <CopyBlock code={`import { BeZhasConnect } from '@bezhas/connect';\n\nconst bezhas = new BeZhasConnect({\n  apiKey: process.env.BEZHAS_API_KEY\n});`} />
      </StepCard>

      <StepCard number={3} title="Pagos (bezhas.pay)">
        <CopyBlock code={`// Tarjeta\nconst order = await bezhas.pay.buy({\n  amountUSD: 100,\n  paymentMethod: 'card',\n  email: 'customer@example.com'\n});\n// → { paymentId, checkoutUrl, ... }\nwindow.location.href = order.checkoutUrl;\n\n// Banco (SEPA/SWIFT)\nconst bank = await bezhas.pay.buy({\n  amountUSD: 5000,\n  paymentMethod: 'bank'\n});\n// → { iban, bic, reference, amount }`} />
      </StepCard>

      <StepCard number={4} title="Logística (bezhas.cargolink)">
        <CopyBlock code={`const pos = bezhas.cargolink.withRoleKey(process.env.POS_KEY);\n\nawait pos.createTx({\n  posRef: 'ORD-12345',\n  origin: 'Algeciras',\n  destination: 'Tánger'\n});\n// → { txId: 'B-abc123', status: 'created' }\n\nawait pos.advanceTx('B-abc123', { note: 'Aduanas OK' });`} />
      </StepCard>

      <StepCard number={5} title="Verificar Webhooks">
        <CopyBlock code={`import { webhooks } from '@bezhas/connect';\n\napp.post('/webhooks/bezhas', express.raw({type:'application/json'}), (req, res) => {\n  const payload = webhooks.verifyAndParse(\n    req.body,\n    req.headers['x-bezhas-signature'],\n    process.env.BEZHAS_WEBHOOK_SECRET\n  );\n  // payload.event → 'payment.completed', 'cargo.delivered', etc.\n  res.json({ received: true });\n});`} />
      </StepCard>
    </div>
  );
}

function WordPressTab() {
  return (
    <div className="space-y-6">
      <div className="bg-pink-900/20 border border-pink-800/40 rounded-xl p-4 mb-6">
        <p className="text-pink-300 text-sm">
          <strong>Requisitos:</strong> WordPress 6.0+ &nbsp;|&nbsp; WooCommerce (opcional) &nbsp;|&nbsp; PHP 7.4+
        </p>
      </div>

      <StepCard number={1} title="Descargar e Instalar">
        <p>Descarga el plugin desde el Hub y súbelo a WordPress.</p>
        <div className="bg-gray-900/70 border border-gray-700 rounded-lg p-4 space-y-2 text-sm text-gray-300">
          <p>1. Ir a: <code className="text-yellow-300">hub.bez.digital/downloads</code></p>
          <p>2. Click <strong>"WordPress Plugin v2.0.0"</strong></p>
          <p>3. WordPress Admin → <strong>Plugins</strong> → <strong>Add New</strong> → <strong>Upload Plugin</strong></p>
          <p>4. Seleccionar <code className="text-yellow-300">bezhas-hub-v2.0.0.zip</code> → <strong>Install Now</strong></p>
          <p>5. Click <strong>Activate</strong></p>
        </div>
      </StepCard>

      <StepCard number={2} title="Configurar API Key">
        <div className="bg-gray-900/70 border border-gray-700 rounded-lg p-4 space-y-2 text-sm text-gray-300">
          <p>1. WordPress → <strong>Settings</strong> → <strong>BeZhas Configuration</strong></p>
          <p>2. Pegar tu <strong>API Key</strong> (obtenida en <code className="text-yellow-300">hub.bez.digital/developers</code>)</p>
          <p>3. Pegar <strong>Webhook Secret</strong> (opcional)</p>
          <p>4. Click <strong>Save Changes</strong></p>
        </div>
      </StepCard>

      <StepCard number={3} title="Activar Métodos de Pago">
        <div className="bg-gray-900/70 border border-gray-700 rounded-lg p-4 space-y-2 text-sm text-gray-300">
          <p>1. WooCommerce → <strong>Settings</strong> → <strong>Payments</strong></p>
          <p>2. Activar <strong>BeZhas Pay</strong> como gateway</p>
          <p>3. Métodos disponibles: 💳 Tarjeta · 🏦 Banco (SEPA) · ₿ BEZ Token</p>
          <p>4. <strong>Save</strong></p>
        </div>
      </StepCard>

      <StepCard number={4} title="Probar">
        <div className="bg-teal-900/20 border border-teal-700/40 rounded-lg p-4">
          <p className="text-teal-300 text-sm">
            ✅ Haz un pedido de prueba → Verifica que aparece en el Hub → Dashboard widget muestra estadísticas
          </p>
        </div>
      </StepCard>
    </div>
  );
}

const FAQ_ITEMS = [
  { q: '¿Puedo usar varios métodos a la vez?', a: 'Sí. Por ejemplo: Plugin WordPress para pagos + API REST para datos de logística.' },
  { q: '¿Qué pasa si pierdo mi API Key?', a: 'Genera una nueva en hub.bez.digital/developers. La anterior se anula automáticamente.' },
  { q: '¿Cuál es el costo?', a: 'API: pay-per-call (tarifas en el portal). SDK: incluido. Plugin WordPress: gratuito.' },
  { q: '¿Qué blockchains soporta?', a: 'Polygon (mainnet), BNB Chain (mainnet), Amoy (testnet de Polygon).' },
  { q: '¿Puedo testear antes de producción?', a: 'Sí. Usa credenciales de sandbox generadas en el Developer Console.' },
  { q: '¿Cuánto tiempo tarda un pago?', a: 'Tarjeta: 2-3 días. SEPA: 1-2 días. Crypto: 10-30 minutos.' },
  { q: '¿Cómo verifico que un webhook es legítimo?', a: 'Siempre valida la firma HMAC-SHA256 del header x-bezhas-signature contra tu webhook secret.' },
  { q: 'Mi webhook da timeout, ¿qué hago?', a: 'Responde 200 inmediatamente, luego procesa en background. BeZhas espera respuesta en <5 segundos.' },
  { q: '¿Qué es el "Rate limit exceeded"?', a: 'Límite de 1000 requests/minuto. Espera 60 segundos o implementa exponential backoff.' },
  { q: '¿Cómo cambio de entorno sandbox a producción?', a: 'Genera una API Key de producción en el Developer Console y reemplaza la de sandbox en tu .env.' },
];

function FaqTab() {
  const [openIdx, setOpenIdx] = useState(null);

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-white mb-4">Preguntas Frecuentes</h2>
      {FAQ_ITEMS.map((item, i) => (
        <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-gray-800/80 transition-colors"
          >
            <span className="text-white font-medium">{item.q}</span>
            <ArrowRight
              size={16}
              className={`text-teal-400 transition-transform ${openIdx === i ? 'rotate-90' : ''}`}
            />
          </button>
          {openIdx === i && (
            <div className="px-5 pb-4 text-gray-300 text-sm border-t border-gray-700/50 pt-3">
              {item.a}
            </div>
          )}
        </div>
      ))}

      <div className="mt-8 bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-5">
        <h3 className="text-yellow-300 font-semibold mb-2">¿No encuentras tu respuesta?</h3>
        <p className="text-gray-400 text-sm">
          Contacta soporte: <code className="text-yellow-300">support@bez.digital</code> · Respuesta en &lt;2 horas.
          También puedes usar el chatbot de la esquina inferior derecha (Ctrl+K).
        </p>
      </div>
    </div>
  );
}

const VIDEO_SCRIPTS = [
  {
    id: 'overview',
    title: 'Introducción a BeZhas — 3 Formas de Integrar',
    duration: '3 min',
    thumbnail: '🎬',
    sections: [
      '00:00 — ¿Qué es BeZhas? Ecosistema blockchain B2B',
      '00:30 — 3 métodos: API REST, SDK, Plugin WordPress',
      '01:00 — Comparación: complejidad, tiempo, casos de uso',
      '02:00 — 13 SubApps: CargoLink, Pay, Capital, Energy…',
      '02:40 — Cómo elegir tu método según tu negocio',
    ],
  },
  {
    id: 'api',
    title: 'Integración API REST — Paso a Paso',
    duration: '5 min',
    thumbnail: '⌨️',
    sections: [
      '00:00 — Generar API Key en hub.bez.digital/developers',
      '00:45 — Guardar credenciales en .env',
      '01:30 — Primera llamada: GET /health',
      '02:15 — Crear pago: POST /api/gateway/v1/pay',
      '03:00 — Crear cargo: POST /api/cargolink/transactions',
      '03:45 — Configurar webhooks y verificar firma',
      '04:30 — Checklist para producción',
    ],
  },
  {
    id: 'sdk',
    title: 'SDK @bezhas/connect — Quick Start',
    duration: '4 min',
    thumbnail: '📦',
    sections: [
      '00:00 — Instalar: pnpm add @bezhas/connect',
      '00:30 — Inicializar SDK con API Key',
      '01:00 — Pagos: bezhas.pay.buy() — tarjeta y banco',
      '02:00 — Logística: bezhas.cargolink.createTx()',
      '03:00 — Webhooks: webhooks.verifyAndParse()',
      '03:30 — Ejemplo React completo',
    ],
  },
  {
    id: 'wp',
    title: 'Plugin WordPress — Setup en 5 Minutos',
    duration: '3 min',
    thumbnail: '🔌',
    sections: [
      '00:00 — Descargar bezhas-hub-v2.0.0.zip',
      '00:30 — Instalar en WordPress Admin',
      '01:00 — Configurar API Key en Settings',
      '01:30 — Activar payment gateway en WooCommerce',
      '02:00 — Hacer compra de prueba',
      '02:30 — Dashboard widget y monitorización',
    ],
  },
  {
    id: 'auth',
    title: 'Autenticación y Seguridad',
    duration: '4 min',
    thumbnail: '🔐',
    sections: [
      '00:00 — 3 formas de autenticarse: SIWE, Email, API Key',
      '00:45 — SIWE: Sign In With Ethereum (wallet)',
      '01:30 — Email + 2FA: flujo tradicional seguro',
      '02:15 — API Key: server-to-server',
      '03:00 — JWT: estructura, expiración, refresh',
      '03:30 — Mejores prácticas de seguridad',
    ],
  },
];

function VideosTab() {
  const [selected, setSelected] = useState(null);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white mb-2">Vídeo Tutoriales</h2>
      <p className="text-gray-400 text-sm mb-6">Guiones de vídeo para cada método de integración. Próximamente como vídeo grabado.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {VIDEO_SCRIPTS.map((v) => (
          <div
            key={v.id}
            onClick={() => setSelected(selected === v.id ? null : v.id)}
            className={`bg-gray-800/50 border rounded-xl p-5 cursor-pointer transition-all ${
              selected === v.id ? 'border-teal-500 bg-gray-800' : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{v.thumbnail}</span>
              <div>
                <h3 className="text-white font-semibold text-sm">{v.title}</h3>
                <span className="text-gray-500 text-xs">{v.duration}</span>
              </div>
            </div>

            {selected === v.id && (
              <div className="mt-3 border-t border-gray-700 pt-3">
                <p className="text-xs text-teal-400 mb-2 font-semibold">Guión del vídeo:</p>
                <ul className="space-y-1.5">
                  {v.sections.map((s, i) => (
                    <li key={i} className="text-gray-300 text-xs flex items-start gap-2">
                      <span className="text-teal-400 font-mono text-[10px] mt-0.5 flex-shrink-0">
                        {s.split(' — ')[0]}
                      </span>
                      <span>{s.split(' — ')[1]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const ClientGuidesPage = () => {
  const [activeTab, setActiveTab] = useState('quickstart');

  const renderTab = () => {
    switch (activeTab) {
      case 'quickstart': return <QuickStartTab onNavigate={setActiveTab} />;
      case 'overview': return <OverviewTab />;
      case 'api': return <ApiTab />;
      case 'sdk': return <SdkTab />;
      case 'wordpress': return <WordPressTab />;
      case 'faq': return <FaqTab />;
      case 'videos': return <VideosTab />;
      default: return <QuickStartTab onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Guías de Integración</h1>
        <p className="text-gray-400">Todo lo que necesitas para integrar BeZhas en tu plataforma</p>
      </div>

      {/* Markdown downloads */}
      <div className="flex flex-wrap justify-center gap-3 mb-8">
        {[
          { name: 'Guía Completa', file: 'BEZHAS_CLIENT_GUIDE.md' },
          { name: 'Casos de Uso', file: 'BEZHAS_USE_CASES.md' },
          { name: 'FAQ & Troubleshooting', file: 'BEZHAS_FAQ_TROUBLESHOOTING.md' },
          { name: 'Guía Completa (ES)', file: 'es/GUIA_COMPLETA.md' },
          { name: 'Guiones de Vídeo', file: 'es/GUIONES_VIDEO.md' },
        ].map((d) => (
          <a
            key={d.file}
            href={`/client-guides/${d.file}`}
            download
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:border-teal-500 hover:text-teal-400 transition-colors"
          >
            <Download size={14} /> {d.name}
          </a>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-gray-800/50 p-1 rounded-xl mb-8 border border-gray-700">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-teal-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {renderTab()}
      </div>
    </div>
  );
};

export default ClientGuidesPage;
