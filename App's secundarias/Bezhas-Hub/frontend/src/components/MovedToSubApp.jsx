import { Link } from 'react-router-dom';
import { SUBAPP_META, subappUrl } from '../config/subappUrls';

/**
 * Panel de "Control Plane": una función operativa ya NO vive en el Hub, sino en
 * su SubApp dedicada. Muestra un resumen breve y un deep-link a la SubApp.
 *
 * Sustituye a las páginas operativas migradas (staking/farming/defi → BZ Capital,
 * etc.) para que las rutas del Hub no queden muertas tras la migración.
 *
 * @param {object}  props
 * @param {string}  props.app        clave de SubApp (ver config/subappUrls.js)
 * @param {string} [props.subPath]   ruta interna dentro de la SubApp
 * @param {string}  props.feature    nombre de la función (p.ej. "Staking")
 * @param {string} [props.description] texto opcional de contexto
 */
export default function MovedToSubApp({ app, subPath = '', feature, description }) {
  const meta = SUBAPP_META[app] || { name: app, tagline: '' };
  const href = subappUrl(app, subPath);

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-xl backdrop-blur">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-teal-500/15 text-2xl">
          🔗
        </div>
        <h1 className="text-xl font-semibold text-white">
          {feature} ahora vive en {meta.name}
        </h1>
        <p className="mt-2 text-sm text-white/60">
          {description ||
            `Esta función se gestiona desde ${meta.name}${meta.tagline ? ` — ${meta.tagline}` : ''}.`}
        </p>

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-teal-500 px-5 py-3 font-medium text-black transition hover:bg-teal-400"
        >
          Abrir {feature} en {meta.name} ↗
        </a>

        <Link
          to="/home"
          className="mt-3 inline-block text-sm text-white/50 transition hover:text-white/80"
        >
          ← Volver al Hub
        </Link>
      </div>
    </div>
  );
}
