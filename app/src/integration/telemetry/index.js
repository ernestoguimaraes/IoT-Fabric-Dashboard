// Fábrica da fonte de telemetria: 'mock' (padrão) ou 'fabric'.
import { createMockSource } from './mock.js';
import { createFabricSource } from './fabric.js';

export function createTelemetrySource(mode, machines) {
  if (mode === 'fabric') return createFabricSource({ apiBase: import.meta.env.VITE_API_BASE || '' });
  return createMockSource(machines);
}
