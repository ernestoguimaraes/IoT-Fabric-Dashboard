import { createMockAgent } from './mock.js';
import { createFoundryAgent } from './foundry.js';

export function createAgent(mode, opts = {}) {
  if (mode === 'foundry') {
    const env = import.meta.env || {};
    // logs de chamada no console do navegador: ligados em dev; VITE_AGENT_DEBUG=true/false força.
    const debug = env.VITE_AGENT_DEBUG ? env.VITE_AGENT_DEBUG === 'true' : !!env.DEV;
    return createFoundryAgent({ apiBase: env.VITE_API_BASE || '', debug });
  }
  if (mode === 'mock') return createMockAgent(opts);
  throw new Error(`Modo de agente inválido: ${mode}`);
}
