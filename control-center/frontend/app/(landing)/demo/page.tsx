import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Gauge,
  LockKeyhole,
  Mail,
  MapPin,
  Plug,
  RadioTower,
  ShieldCheck,
} from 'lucide-react';

const contactFeed = [
  { company: 'Terminal Link Texas', role: 'Terminal services', status: 'Email enviado', flow: 'Smart Escrow operativo' },
  { company: 'PSA Antwerp CFS', role: 'Container freight station', status: 'Email enviado', flow: 'Hitos CFS + conciliacion' },
  { company: 'DP World Antwerp Gateway', role: 'Terminal operator', status: 'Borrador HITL', flow: 'Derivacion a Ops/IT' },
  { company: 'MPET Antwerp', role: 'Container terminal', status: 'Borrador HITL', flow: 'Validacion + auditoria' },
  { company: 'Noatum Logistics', role: 'Logistica global', status: 'Contactado', flow: 'Validacion documental' },
  { company: 'CSP Valencia', role: 'Terminal mediterranea', status: 'Contactado', flow: 'Trazabilidad operativa' },
];

const flows = [
  {
    name: 'Despacho y tasas',
    icon: FileCheck2,
    steps: ['Documento recibido', 'Aegis AI valida campos', 'Evento certificado', 'Fee liberado'],
    metric: 'Menos conciliacion manual',
    detail: 'Pensado para aduanas, terminales, transitarios y brokers que trabajan con multiples sistemas.',
  },
  {
    name: 'Servicio terminal',
    icon: CircleDollarSign,
    steps: ['Gate-in', 'Inspeccion', 'Servicio completado', 'Smart Escrow liquidado'],
    metric: 'Menos disputas por hitos',
    detail: 'Muestra como se liberan pagos o fees cuando el evento operativo queda verificado.',
  },
];

const auditEvents = [
  { time: '08:10', actor: 'ERP / PCS', event: 'Manifiesto importado', state: 'Verificado' },
  { time: '08:14', actor: 'Aegis AI', event: 'Anomalias revisadas', state: 'Sin bloqueo' },
  { time: '08:21', actor: 'Edge Node', event: 'Gate-in certificado', state: 'Hash emitido' },
  { time: '08:23', actor: 'Smart Escrow', event: 'Regla de liberacion lista', state: 'Pendiente HITL' },
];

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-8 md:px-8">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                Demo read-only
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-600">
                <LockKeyhole className="h-4 w-4" />
                Sin GCP ni mainnet requerida
              </span>
            </div>
            <h1 className="max-w-3xl text-4xl font-black uppercase leading-tight tracking-normal md:text-6xl">
              BeZhas-Blockchain operativo, explicado desde flujos reales.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
              Esta vista permite a un cliente entender la plataforma antes de desplegar infraestructura:
              integra eventos, valida documentos, registra evidencia y prepara reglas de Smart Escrow con datos simulados.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ['2', 'flujos demo'],
                ['4', 'eventos auditables'],
                ['0', 'acciones on-chain'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-3xl font-black text-slate-950">{value}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Control Center</p>
                <h2 className="mt-1 text-xl font-black">Estado de la simulacion</h2>
              </div>
              <Activity className="h-6 w-6 text-cyan-300" />
            </div>
            <div className="mt-5 grid gap-3">
              {[
                { icon: Plug, label: 'Integracion', value: 'ERP / PCS / API', tone: 'text-cyan-300' },
                { icon: RadioTower, label: 'Edge Node', value: 'Mock local', tone: 'text-amber-300' },
                { icon: Gauge, label: 'Riesgo', value: 'Bajo para demo', tone: 'text-emerald-300' },
                { icon: Clock3, label: 'Tiempo piloto', value: '2-4 semanas', tone: 'text-violet-300' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-3">
                    <item.icon className={`h-5 w-5 ${item.tone}`} />
                    <span className="text-sm font-semibold text-slate-300">{item.label}</span>
                  </div>
                  <span className="text-sm font-black">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          {flows.map((flow) => (
            <div key={flow.name} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Flujo read-only</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">{flow.name}</h2>
                </div>
                <div className="rounded-lg bg-slate-950 p-3 text-white">
                  <flow.icon className="h-6 w-6" />
                </div>
              </div>
              <p className="mb-5 text-sm leading-6 text-slate-600">{flow.detail}</p>
              <div className="grid gap-3">
                {flow.steps.map((step, index) => (
                  <div key={step} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black text-slate-700 ring-1 ring-slate-200">
                      {index + 1}
                    </span>
                    <span className="text-sm font-semibold text-slate-800">{step}</span>
                    {index < flow.steps.length - 1 && <ArrowRight className="ml-auto h-4 w-4 text-slate-400" />}
                    {index === flow.steps.length - 1 && <CheckCircle2 className="ml-auto h-5 w-5 text-emerald-500" />}
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{flow.metric}</div>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Feed comercial</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Contactos recientes</h2>
              </div>
              <Mail className="h-6 w-6 text-slate-500" />
            </div>
            <div className="grid gap-3">
              {contactFeed.map((contact) => (
                <div key={contact.company} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black text-slate-950">{contact.company}</h3>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{contact.role}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{contact.status}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{contact.flow}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Auditoria</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Registro de eventos</h2>
              </div>
              <MapPin className="h-6 w-6 text-slate-500" />
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              {auditEvents.map((event) => (
                <div key={`${event.time}-${event.event}`} className="grid grid-cols-[70px_1fr_auto] gap-4 border-b border-slate-200 bg-white p-4 last:border-b-0">
                  <span className="font-mono text-xs font-bold text-slate-500">{event.time}</span>
                  <div>
                    <p className="text-sm font-black text-slate-950">{event.event}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{event.actor}</p>
                  </div>
                  <span className="self-start rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">{event.state}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/support" className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-bold text-white">
                Pedir piloto
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/enterprise" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-sm font-bold text-slate-800">
                Ver Enterprise
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
