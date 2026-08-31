import { SimulationStep, TransitMode } from '../types';
import { buildOriginSteps } from './zfCadiz';
import { buildTransitSteps } from './transit';
import { buildDestinationSteps } from './destination';

// Índice (0-based) del primer paso de tránsito: a partir de aquí es inyectable el breach
export const BREACH_FROM_INDEX = 10;

export const buildFlow360 = (mode: TransitMode): SimulationStep[] => [
  ...buildOriginSteps(mode),
  ...buildTransitSteps(mode),
  ...buildDestinationSteps(mode),
];

export const FLOW_360_SEA = buildFlow360('sea');
export const FLOW_360_AIR = buildFlow360('air');
