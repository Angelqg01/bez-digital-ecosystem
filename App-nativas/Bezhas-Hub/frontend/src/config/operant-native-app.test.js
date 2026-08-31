/**
 * El espejo público de OPERANT contra su fuente canónica.
 *
 * `config/operant-native-app.js` es lo que ve el cliente en /be-vip; la verdad vive
 * en `api/config/operant-services.js`, del lado del backend. Son dos archivos
 * porque el frontend no puede importar del backend en tiempo de build — pero eso
 * los deja libres de separarse, y el día que lo hagan la página prometería una
 * cuota que la API no concede. Este test es lo que impide que pase en silencio.
 *
 * También comprueba lo contrario: que el espejo NO arrastre datos internos.
 * Coste real y margen bruto no se publican.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import {
    OPERANT_BY_PLAN,
    OPERANT_DEPARTMENTS,
    OPERANT_TASK_PRICE_EUR,
    OPERANT_MODULE_PRICE_EUR,
    getOperantPlan,
    paygValueOf,
    savingsVsPayg,
} from './operant-native-app';

const require_ = createRequire(import.meta.url);
const CANONICAL = path.resolve(
    __dirname,
    '../../../../../api/config/operant-services.js'
);

// El backend vive en otro paquete del monorepo. Si no está (checkout parcial),
// se salta en vez de fallar: un test rojo por un archivo ausente no dice nada
// sobre la divergencia, que es lo único que aquí interesa.
const disponible = fs.existsSync(CANONICAL);
const canonical = disponible ? require_(CANONICAL) : null;

describe('OPERANT — el espejo público no se separa del catálogo real', () => {
    it.skipIf(!disponible)('los planes son los mismos', () => {
        expect(Object.keys(OPERANT_BY_PLAN).sort())
            .toEqual(Object.keys(canonical.PLAN_MATRIX).sort());
    });

    it.skipIf(!disponible)('los departamentos son los mismos y con el mismo tier', () => {
        const real = canonical.DEPARTMENTS.map((d) => `${d.id}:${d.tier}`).sort();
        const espejo = OPERANT_DEPARTMENTS.map((d) => `${d.id}:${d.tier}`).sort();
        expect(espejo).toEqual(real);
    });

    it.skipIf(!disponible)('cuotas, límites, autonomía y anclaje coinciden plan a plan', () => {
        for (const [id, real] of Object.entries(canonical.PLAN_MATRIX)) {
            const espejo = OPERANT_BY_PLAN[id];
            expect({ id, ...pick(espejo) }).toEqual({ id, ...pick(real) });
        }
    });

    it.skipIf(!disponible)('el precio por tarea que se publica es el que factura el backend', () => {
        const frontier = canonical.estimateTaskCost('sales').billableEUR;
        const mid = canonical.estimateTaskCost('support').billableEUR;
        expect(OPERANT_TASK_PRICE_EUR.frontier).toBeCloseTo(frontier, 4);
        expect(OPERANT_TASK_PRICE_EUR.mid).toBeCloseTo(mid, 4);
    });

    it.skipIf(!disponible)('las capacidades on-chain de cada plan coinciden', () => {
        for (const [id, real] of Object.entries(canonical.PLAN_MATRIX)) {
            expect(OPERANT_BY_PLAN[id].onchain.sort()).toEqual([...real.onchain].sort());
        }
    });
});

describe('OPERANT — el espejo no filtra datos internos', () => {
    it('no publica coste real ni margen', () => {
        const fuente = fs.readFileSync(path.join(__dirname, 'operant-native-app.js'), 'utf8');
        // El comentario de cabecera explica por qué no están; se busca en el
        // objeto exportado, no en el texto del archivo.
        for (const plan of Object.values(OPERANT_BY_PLAN)) {
            expect(plan).not.toHaveProperty('rawCostEUR');
            expect(plan).not.toHaveProperty('margin');
            expect(plan).not.toHaveProperty('worstCaseCostEUR');
        }
        expect(fuente).not.toMatch(/margen bruto\s*[:=]|MARGIN_RATE|rawCostEUR/);
    });
});

describe('OPERANT — alias de los tiers de /be-vip', () => {
    it("'creator' y 'enterprise' resuelven a su plan canónico", () => {
        expect(getOperantPlan('creator')).toBe(OPERANT_BY_PLAN.creator_pro);
        expect(getOperantPlan('enterprise')).toBe(OPERANT_BY_PLAN.enterprise_vip);
    });

    it('un plan desconocido devuelve null, no el más generoso', () => {
        expect(getOperantPlan('inventado')).toBeNull();
    });
});

/** Campos del plan que ambos lados deben compartir palabra por palabra. */
function pick(p) {
    return {
        departments: [...p.departments].sort(),
        includedTasks: p.includedTasks,
        frontierCap: p.frontierCap,
        maxConcurrent: p.maxConcurrent,
        rpm: p.rpm,
        autonomy: p.autonomy,
        anchor: p.anchor,
        retentionDays: p.retentionDays,
    };
}


/**
 * El precio del módulo vive dentro de una ventana con dos bordes duros:
 *
 *   suelo — coste de servir la cuota entera. Por debajo, la plataforma pierde
 *           dinero justo con el cliente que más usa el producto.
 *   techo — lo que costaría comprar esa cuota suelta a pago por uso. Por
 *           encima, al cliente le sale mejor no activar el módulo, y entonces
 *           el módulo no se vende.
 *
 * Un cambio de cuota, de tier de un departamento o de precio de Anthropic mueve
 * esos bordes. Estos tests son lo que impide que el precio se quede fuera sin
 * que nadie se entere hasta ver la factura.
 */
describe.skipIf(!disponible)('OPERANT — el precio del módulo se mantiene en su ventana', () => {
    const dePago = ['creator_pro', 'business', 'enterprise_vip'];

    it.each(dePago)('%s: el precio cubre el coste incluso a consumo del 100%%', (id) => {
        const suelo = canonical.worstCaseMonthlyCost(id).totalCostEUR;
        expect(OPERANT_MODULE_PRICE_EUR[id]).toBeGreaterThan(suelo);
    });

    it.each(dePago)('%s: activar el módulo sale más barato que comprar la cuota suelta', (id) => {
        expect(OPERANT_MODULE_PRICE_EUR[id]).toBeLessThan(paygValueOf(id));
        expect(savingsVsPayg(id)).toBeGreaterThanOrEqual(10);
    });

    it.each(dePago)('%s: margen holgado al consumo esperado (45%% de la cuota)', (id) => {
        const esperado = canonical.worstCaseMonthlyCost(id).totalCostEUR * 0.45;
        const margen = 1 - esperado / OPERANT_MODULE_PRICE_EUR[id];
        expect(margen).toBeGreaterThanOrEqual(0.5);
    });

    it('Starter no paga módulo: es pago por uso desde la primera tarea', () => {
        expect(OPERANT_MODULE_PRICE_EUR.starter).toBe(0);
        expect(OPERANT_BY_PLAN.starter.includedTasks).toBe(0);
    });

    it('el precio sube con la capacidad, nunca al revés', () => {
        const precios = ['starter', ...dePago].map((id) => OPERANT_MODULE_PRICE_EUR[id]);
        const ordenado = [...precios].sort((a, b) => a - b);
        expect(precios).toEqual(ordenado);
    });

    it('el valor a pago por uso se calcula con el mismo mix que factura el backend', () => {
        for (const id of dePago) {
            const p = canonical.PLAN_MATRIX[id];
            const fr = Math.min(p.frontierCap, p.includedTasks);
            const mid = p.includedTasks - fr;
            const esperado =
                fr * canonical.estimateTaskCost('sales').billableEUR +
                mid * canonical.estimateTaskCost('support').billableEUR;
            expect(paygValueOf(id)).toBeCloseTo(esperado, 2);
        }
    });
});
