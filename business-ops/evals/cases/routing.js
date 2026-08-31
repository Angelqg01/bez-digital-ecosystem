'use strict';

/**
 * Contrato: una solicitud de cliente llega al departamento correcto.
 * Si el enrutado falla, todo lo demás falla — por eso es la primera suite.
 */
const Orchestrator = require('../../src/core/Orchestrator');
const { expect } = require('../world');

const CASES = [
  ['Quiero una demo y precio para 10 usuarios', 'sales'],
  ['Envíame una propuesta comercial', 'sales'],
  ['¿Cuánto cuesta el plan pro? Quiero comprar', 'sales'],
  ['La exportación no funciona, necesito ayuda', 'support'],
  ['Tengo un problema con mi cuenta', 'support'],
  ['Prepara un post para redes sociales', 'marketing'],
  ['Necesitamos mejorar el SEO de la web', 'marketing'],
  ['Revisa el CV de este candidato para la vacante', 'hr'],
  ['¿Cuándo se paga la nómina a los empleados?', 'hr'],
  ['Genera la factura de junio y reclama el impago', 'finance'],
  ['Concilia los cobros del mes en contabilidad', 'finance'],
  ['Necesito el informe operativo semanal', 'operations'],
  ['Revisa el inventario y avisa si falta stock', 'operations'],
  ['Pide presupuesto al proveedor de logística', 'operations'],
  ['¿Cuántos validadores activos tenemos ahora mismo?', 'blockchain'],
  ['Revisa el estado del bridge y el precio del gas', 'blockchain'],
  ['Revisa el contrato antes de firmarlo', 'legal'],
  ['¿Cumplimos con el RGPD en este flujo de datos?', 'legal'],
  ['Quiero un contrato y precio para 10 usuarios', 'sales'], // "contrato" ambiguo, gana sales por señal comercial más fuerte
  ['¿Cuántos meses de autonomía le quedan a la tesorería?', 'treasury'],
  ['Dame un informe de tokenomics de BEZ-Coin', 'treasury'],
  ['Este fondo de capital quiere agendar una due diligence', 'fundraising'],
  ['Contacta a este family office para la ronda de inversión', 'fundraising'],
  ['hola buenas', 'support'], // sin señal → soporte (default seguro)
];

module.exports = {
  suite: 'routing',
  description: 'clasificación de intención → departamento',
  cases: [
    ...CASES.map(([text, dept]) => ({
      name: `"${text.slice(0, 44)}" → ${dept}`,
      async check() {
        const intent = await Orchestrator.prototype._classify.call(null, { text });
        expect(intent.department === dept, `esperaba ${dept}, obtuvo ${intent.department}`);
      },
    })),
    {
      name: 'un webhook con type/department explícitos se salta la clasificación por palabras clave',
      async check() {
        const intent = await Orchestrator.prototype._classify.call(null, {
          text: 'esto no debería importar para la clasificación',
          type: 'finance:token-purchase', department: 'finance',
        });
        expect(intent.department === 'finance' && intent.type === 'finance:token-purchase', 'debe respetar type/department explícitos');
      },
    },
  ],
};
