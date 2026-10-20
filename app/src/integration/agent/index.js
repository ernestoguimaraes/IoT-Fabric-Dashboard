import { createMockAgent } from './mock.js';
import { createFoundryAgent } from './foundry.js';

export function createAgent(mode, opts = {}) {
  if (mode === 'foundry') return createFoundryAgent({ apiBase: import.meta.env.VITE_API_BASE || '' });
  return createMockAgent(opts);
}
