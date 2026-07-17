import { Validator } from './types';

// Validadores con DIDs W3C (Fase A: Zona Franca Origen · Fase B/C: corredor internacional)
export const VALIDATORS: Record<string, Validator> = {
  fabricante:    { name: 'Fabricante SL',            did: 'did:ind:fabricante:es:e8c4d1',   icon: '🏭' },
  operador:      { name: 'Operador Logístico',       did: 'did:log:operador:es:7d2f1a',     icon: '📦' },
  transportista: { name: 'Transportista Local',      did: 'did:log:transportista:loc:4b8c2e', icon: '🚛' },
  consorcioZF:   { name: 'Consorcio Zona Franca',    did: 'did:zf:consorcio:a3b7c2',        icon: '🏛️' },
  depositoZF:    { name: 'Depósito Franco',          did: 'did:zf:deposito:6e1f9a',         icon: '🏗️' },
  aeat:          { name: 'Agencia Tributaria',       did: 'did:etr:aduanas:es:c3728a',      icon: '⚖️' },
  inspector:     { name: 'Inspector Aduanero',       did: 'did:etr:inspector:es:2d5b7c',    icon: '🔍' },
  puertoCadiz:   { name: 'Autoridad Portuaria',      did: 'did:port:origin:apbc:9f1e4d',    icon: '⚓' },
  naviera:       { name: 'Compañía Naviera',         did: 'did:mar:naviera:es:5a9b3e',      icon: '🚢' },
  aerolinea:     { name: 'Aerolínea de Carga',       did: 'did:air:carrier:intl:1e8f4b',    icon: '✈️' },
  consenso:      { name: 'Red Consenso BeZhas L2',   did: 'did:bez:consensus:l2:0a1b2c',    icon: '🔗' },
  aduanaDestino: { name: 'Aduana Destino',           did: 'did:cus:destino:intl:8c3d5e',    icon: '🛃' },
  terminalDest:  { name: 'Operador Terminal Destino', did: 'did:port:destino:opr:3f7a1d',   icon: '🏗️' },
  lastmile:      { name: 'Flota Última Milla',       did: 'did:log:lastmile:intl:9b2e4f',   icon: '🚚' },
  distribuidor:  { name: 'Distribuidor Final',       did: 'did:com:distribuidor:7c5d3a',    icon: '🏪' },
};

export const VALIDATOR_LIST: Validator[] = Object.values(VALIDATORS);
