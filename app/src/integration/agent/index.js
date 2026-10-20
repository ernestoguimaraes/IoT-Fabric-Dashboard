import { createMockAgent } from './mock.js';
import { createFoundryAgent } from './foundry.js';

export function createAgent(mode, opts = {}) {
  if (mode === 'foundry') return createFoundryAgent({ apiBase: import.meta.env?.VITE_API_BASE || '' });
  if (mode === 'mock') return createMockAgent(opts);
  throw new Error(`Modo de agente inválido: ${mode}`);
}
