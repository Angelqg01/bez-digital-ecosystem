/**
 * Lo que arregla el informe del CTO energético (R1–R4): conocimiento de energía con el estado real, cifras comprobadas,
 * precios y límites redactados por el servidor y Enterprise VIP para holdings.
 */
const { respuestaDeterminista, quierePrecios, quiereLimites, esHolding } = require('../../services/ai-workspace/facts');
const { comprobarCifras, cifrasDe, valores } = require('../../services/ai-workspace/figures');
const { siguientePaso } = require('../../services/ai-workspace/guide');
const { textoPlanes, textoLimites } = require('../../services/knowledge/planFacts');
const { DOCS } = require('../../services/knowledge/seed');
const { PLANS } = require('../../config/plans');

const P = { plan: 'business' };
const T9 = 'Somos un grupo con 8 sociedades y varios parques. ¿Qué plan nos conviene y cuánto cuesta?';

describe('R3: precios y límites los redacta el servidor desde la configuración', () => {
    it('T9: recomienda Enterprise VIP, da los precios reales y niega el precio por sociedad', () => {
        const r = respuestaDeterminista(P, T9);
        expect(r.tipo).toBe('precios');
        expect(r.texto).toContain(textoPlanes());
        expect(r.texto).toMatch(/Enterprise VIP/);
        expect(r.texto).toMatch(/499 €\/mes/);
        expect(r.texto).toMatch(/no existe un precio por sociedad/);
        expect(r.texto).not.toMatch(/19,99|159,92/);
    });
    it('cada precio del texto sale de PLANS (no hay cifras sueltas)', () => {
        const r = respuestaDeterminista(P, '¿Cuánto cuesta el plan Business?');
        for (const p of PLANS.filter((x) => x.priceEUR)) expect(r.texto).toContain(`${p.name} (${p.profile})`);
    });
    it('T7: los límites son los de la configuración, de los tres planes, sin autocorrecciones', () => {
        const r = respuestaDeterminista(P, '¿Qué límites y aprobaciones hay para mover fondos desde la tesorería del grupo?');
        expect(r.tipo).toBe('limites');
        expect(r.texto).toContain(textoLimites());
        expect(r.texto).toMatch(/Enterprise VIP: .*100\.000 € por operación/);
        expect(r.texto).not.toMatch(/Corrección|asumo/);
    });
    it('precios y límites a la vez', () => {
        expect(respuestaDeterminista(P, '¿Cuánto cuesta el plan Business y qué límites de pago tiene?').tipo).toBe('precios+limites');
    });
    it.each([
        '¿Cuánto cuesta tokenizar un activo?', '¿Cuánto vale un BEZ?', '¿Qué comisión cobráis por BEZ-Pay?',
        'Qué plan necesito para conectar SAP', '¿Cuánto cuesta el gas de las transacciones?', '¿Cuánto cuesta conectar mi ERP por API?',
        '¿Cuál es la capital de Francia?', 'hola',
    ])('«%s» NO se contesta con la tabla de planes (va al modelo con su documento)', (q) => {
        expect(respuestaDeterminista(P, q)).toBeNull();
    });
    it('detecta holding sin confundir una pregunta cualquiera', () => {
        expect(esHolding('somos un holding')).toBe(true);
        expect(esHolding('tenemos 8 sociedades')).toBe(true);
        expect(esHolding('mi grupo energetico')).toBe(true); // recibe el texto ya normalizado (sin acentos)
        expect(respuestaDeterminista(P, '¿Qué plan nos conviene como grupo energético y cuánto cuesta?').texto).toMatch(/Si es un grupo con varias sociedades/);
        expect(esHolding('quiero un plan para mi empresa')).toBe(false);
        expect(quierePrecios('cuanto cuesta el plan business')).toBe(true);
        expect(quiereLimites('limites para mover fondos')).toBe(true);
    });
});

describe('R4: la guía propone Enterprise VIP a un grupo con varias sociedades', () => {
    it('lo dice, por organización y no por sociedad', () => {
        const t = siguientePaso({ plan: 'business' }, 'somos un holding con 8 sociedades, ¿qué plan?').texto;
        expect(t).toMatch(/Enterprise VIP/);
        expect(t).toMatch(/no hay precio por sociedad/);
    });
    it('no insiste a quien ya tiene Enterprise VIP', () => {
        expect(siguientePaso({ plan: 'enterprise_vip' }, 'somos un holding con 8 sociedades').texto).not.toMatch(/Plan para un grupo/);
    });
    it('tema de energía: remite a BEZ Energy y avisa de la parte en demostración', () => {
        const r = siguientePaso({ plan: 'business' }, '¿podéis optimizar nuestras baterías con OMIE?');
        expect(r.tema).toBe('energia');
        expect(r.texto).toMatch(/BEZ Energy/);
        expect(r.texto).toMatch(/demostración con datos simulados/);
    });
    it('tokenizar un parque solar sigue siendo el flujo de tokenización, no el de energía', () => {
        expect(siguientePaso({ plan: 'business' }, 'queremos tokenizar un parque solar').tema).toBe('tokenizacion');
    });
});

describe('R2: comprobación de cifras', () => {
    const CTX = 'Business: 499 €/mes + IVA o 4990 €/año; 15.000 acciones de IA; 50% de subvención de gas. Creator Pro: 99 €/mes. IVA 21 %.';
    const MALA = 'Para 8 sociedades el plan Business es lo mejor.\n\nEl coste es de **19,99 € al mes** por entidad (sociedad).\n\n- Coste total para 8 sociedades: $19,99 \\times 8 = 159,92$ € / mes.\n- Incluye 15.000 acciones de IA y 50% de subvención.\n\nSiguiente: confirma.';

    it('T9 real: quita el precio inventado y el cálculo, conserva lo demás y avisa', () => {
        const r = comprobarCifras(MALA, { contexto: CTX, mensaje: 'Somos un grupo con 8 sociedades' });
        expect(r.text).not.toMatch(/19,99|159,92/);
        expect(r.text).toMatch(/15\.000 acciones de IA y 50% de subvención/);
        expect(r.text).toMatch(/He retirado de esta respuesta una o más cifras/);
        expect(r.retiradas.length).toBeGreaterThanOrEqual(2);
    });
    it('una respuesta fiel no se toca (formatos 499 €, 4.990 €, 15000, 50 %)', () => {
        const ok = 'Business cuesta 499 € al mes (4.990 €/año) y da 15000 acciones, con un 50 % de subvención. IVA del 21%.';
        expect(comprobarCifras(ok, { contexto: CTX })).toEqual({ text: ok, retiradas: [] });
    });
    it('una cifra que dijo el usuario puede repetirse (12 %)', () => {
        const t = 'No puedo garantizar un 12 % anual.';
        expect(comprobarCifras(t, { mensaje: 'garantizadnos un 12% anual' }).retiradas).toEqual([]);
    });
    it('sin cifras con unidad no hace nada (recuentos, años, versiones)', () => {
        const t = 'Tienes 8 sociedades, 3 parques y la versión 2 desde 2026.';
        expect(comprobarCifras(t, {}).retiradas).toEqual([]);
    });
    it('una cifra inventada con $ o dólares también se retira', () => {
        expect(comprobarCifras('Cuesta 1250 dólares al año.', { contexto: CTX }).retiradas.length).toBe(1);
        expect(comprobarCifras('Rentabilidad del 8 %.', { contexto: CTX }).retiradas.length).toBe(1);
    });
    it('lee bien los formatos numéricos', () => {
        expect(valores('1.500')).toEqual(expect.arrayContaining([1.5, 1500]));
        expect(valores('2.499,90')).toEqual([2499.9]);
        expect(valores('19,99')).toEqual([19.99]);
        expect(valores('15 000')).toEqual([15000]);
        expect(cifrasDe('de 99 € a 25 % y $5').map((c) => c.crudo)).toEqual(['99', '25', '5']);
    });
});

describe('R1: conocimiento de energía con el estado real', () => {
    const doc = (id) => DOCS.find((d) => d[0] === id)[2];
    it('existen los cinco documentos de energía', () => {
        for (const id of ['bz_energia_app', 'bz_energia_mercado', 'bz_energia_telemetria', 'bz_energia_cae', 'bz_energia_tokenizar']) expect(doc(id)).toBeTruthy();
    });
    it('dicen lo que SÍ existe (OMIE, arbitraje con aprobación humana, Edge Node)', () => {
        expect(doc('bz_energia_mercado')).toMatch(/OMIE/);
        expect(doc('bz_energia_mercado')).toMatch(/aprobación humana/);
        expect(doc('bz_energia_telemetria')).toMatch(/Edge Node/);
    });
    it('y dicen lo que NO está: telemetría simulada, driver pendiente, contratos sin confirmar, sin equivalencia kWh–BEZ', () => {
        expect(doc('bz_energia_telemetria')).toMatch(/pendiente/);
        expect(doc('bz_energia_telemetria')).toMatch(/simulados/);
        expect(doc('bz_energia_cae')).toMatch(/no todos constan como desplegados/);
        expect(doc('bz_energia_cae')).toMatch(/No existe una equivalencia fija entre un kWh y un BEZ/);
        expect(doc('bz_energia_cae')).toMatch(/no hay rentabilidad garantizada/);
    });
    it('la tokenización de un parque no pide desplegar contratos propios', () => {
        expect(doc('bz_energia_tokenizar')).toMatch(/No hay que desplegar ningún contrato propio/);
    });
    it('ningún documento de energía promete rentabilidades ni cifras de precio', () => {
        for (const id of ['bz_energia_app', 'bz_energia_mercado', 'bz_energia_telemetria', 'bz_energia_cae', 'bz_energia_tokenizar']) {
            expect(cifrasDe(doc(id)).map((c) => c.fragmento)).toEqual(expect.not.arrayContaining(['12 %']));
            expect(doc(id)).not.toMatch(/\d+\s?%\s?(anual|de rentabilidad)/i);
        }
    });
});
