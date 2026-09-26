const { estimarCoste } = require('../../services/costEstimate');
const { calculateCallCost, EUR_PER_CREDIT } = require('../../config/usage-pricing');
const { estimateTaskCost } = require('../../config/operant-services');
const { calculateFeeBreakdown } = require('../../config/tokenomics');

describe('costEstimate', () => {
    it('usa exactamente la tarifa con la que se factura', () => {
        // Si la estimación tuviera precios propios, podría desviarse de la
        // factura sin que nadie lo notara. Tiene que salir de las mismas funciones.
        const r = estimarCoste({ plan: 'starter', operaciones: [{ tipo: 'llamada_api', cantidad: 1000 }] });
        const unidad = calculateCallCost({ action: 'api_call' }).credits;
        expect(r.lineas[0].creditosPorUnidad).toBe(unidad);
        expect(r.lineas[0].creditos).toBe(unidad * 1000);
        expect(r.lineas[0].eur).toBeCloseTo(unidad * 1000 * EUR_PER_CREDIT, 6);
    });

    it('Starter: lo estimado es lo que se paga por uso', () => {
        const r = estimarCoste({ plan: 'starter', operaciones: [{ tipo: 'consulta_oraculo', cantidad: 10 }] });
        expect(r.lineas[0].cobertura).toBe('pago_por_uso');
        expect(r.resumen.aPagarPorUso.creditos).toBe(r.resumen.precioDeLista.creditos);
    });

    it('en planes de cuota las llamadas no suman a lo que se paga por uso', () => {
        // gateway-metering sólo mide Starter: decirle a un Business que pagará
        // por llamada sería falso.
        const r = estimarCoste({ plan: 'business', operaciones: [{ tipo: 'llamada_api', cantidad: 5000 }] });
        expect(r.lineas[0].cobertura).toBe('incluido_en_cuota');
        expect(r.resumen.aPagarPorUso.creditos).toBe(0);
        expect(r.resumen.precioDeLista.creditos).toBeGreaterThan(0);
    });

    it('acciones de IA: cuota del plan y sin límite en Enterprise VIP', () => {
        const pro = estimarCoste({ plan: 'creator_pro', operaciones: [{ tipo: 'accion_ia' }] });
        expect(pro.lineas[0].cobertura).toBe('incluido_hasta_cuota');
        expect(pro.lineas[0].nota).toMatch(/1500 acciones/);
        const vip = estimarCoste({ plan: 'enterprise_vip', operaciones: [{ tipo: 'accion_ia' }] });
        expect(vip.lineas[0].cobertura).toBe('incluido_en_cuota');
    });

    it('accion_ia sin tokens avisa de que el modelo va aparte; con tokens lo incluye', () => {
        const sin = estimarCoste({ plan: 'starter', operaciones: [{ tipo: 'accion_ia' }] });
        expect(sin.lineas[0].aviso).toMatch(/tokens del modelo/);
        const con = estimarCoste({
            plan: 'starter', operaciones: [{ tipo: 'accion_ia', tokens_entrada: 20000, tokens_salida: 4000 }],
        });
        expect(con.lineas[0].aviso).toBeUndefined();
        expect(con.lineas[0].creditosPorUnidad).toBeGreaterThan(sin.lineas[0].creditosPorUnidad);
    });

    it('relay on-chain advierte de que el gas no está incluido', () => {
        const r = estimarCoste({ plan: 'starter', operaciones: [{ tipo: 'relay_onchain' }] });
        expect(r.lineas[0].aviso).toMatch(/gas/);
    });

    it('OPERANT: precio de la tarea, cuota del plan y departamentos no incluidos', () => {
        const r = estimarCoste({
            plan: 'creator_pro',
            operaciones: [
                { tipo: 'tarea_operant', departamento: 'sales', cantidad: 10 },
                { tipo: 'tarea_operant', departamento: 'legal' },
            ],
        });
        expect(r.lineas[0].creditosPorUnidad).toBe(estimateTaskCost('sales').credits);
        expect(r.lineas[0].cobertura).toBe('incluido_hasta_cuota');
        expect(r.lineas[0].nota).toMatch(/300 tareas/);
        expect(r.lineas[1].cobertura).toBe('no_incluido_en_plan');
        expect(r.resumen.noIncluidoEnTuPlan).toEqual([r.lineas[1].concepto]);
        expect(r.resumen.siSuperasTuCuota.creditos).toBe(r.lineas[0].creditos);
    });

    it('compra de BEZ: comisión de plataforma en USD, fuera del total en créditos', () => {
        const r = estimarCoste({ plan: 'starter', operaciones: [{ tipo: 'compra_bez', importe_usd: '1000' }] });
        const f = calculateFeeBreakdown(1000);
        expect(r.lineas[0].comisionPlataformaUsd).toBe(f.platformFeeUSD);
        expect(r.lineas[0].totalUsd).toBe(f.grossAmountUSD);
        expect(r.resumen.comisionesUsd).toBe(f.platformFeeUSD);
        expect(r.resumen.precioDeLista.creditos).toBe(0);
    });

    it('un plan desconocido se estima como el más restrictivo', () => {
        const r = estimarCoste({ plan: 'business_v2', operaciones: [{ tipo: 'llamada_api' }] });
        expect(r.plan).toBe('starter');
        expect(r.lineas[0].cobertura).toBe('pago_por_uso');
    });

    it('rechaza combinaciones inválidas con un motivo que el agente puede usar', () => {
        expect(() => estimarCoste({ operaciones: [] })).toThrow(/entre 1 y 20/);
        expect(() => estimarCoste({ operaciones: [{ tipo: 'tarea_operant' }] })).toThrow(/departamento/);
        expect(() => estimarCoste({ operaciones: [{ tipo: 'compra_bez' }] })).toThrow(/importe_usd/);
        expect(() => estimarCoste({ operaciones: [{ tipo: 'llamada_api', cantidad: 0 }] })).toThrow(/cantidad/);
        expect(() => estimarCoste({ operaciones: [{ tipo: 'inventado' }] })).toThrow(/desconocido/);
    });

    it('declara lo que no incluye y que la consulta no consume créditos', () => {
        const r = estimarCoste({ plan: 'starter', operaciones: [{ tipo: 'llamada_api' }] });
        expect(r.noIncluye).toEqual(expect.arrayContaining(['gas de la red']));
        expect(r.estaConsulta).toMatch(/no consume créditos/);
    });
});
