// Ponto de entrada da SPA: cena 3D + store reativo + integrações (Fabric RTI / Foundry).
import { $, pad } from './ui/dom.js';
import { store, selectMachine, attachTelemetrySource, applyTelemetry, setConnection } from './state.js';
import { initScene } from './scene/scene.js';
import { createTelemetrySource } from './integration/telemetry/index.js';
import { createAgent } from './integration/agent/index.js';
import { machineSnapshot } from './integration/agent/context.js';
import { mountSidePanels } from './ui/sidePanels.js';
import { mountInfoPanel } from './ui/infoPanel.js';
import { mountParamsModal } from './ui/paramsModal.js';
import { mountAssistant } from './ui/assistant.js';

const TELEMETRY_MODE = import.meta.env.VITE_TELEMETRY_MODE === 'fabric' ? 'fabric' : 'mock';
const AGENT_MODE = import.meta.env.VITE_AGENT_MODE === 'foundry' ? 'foundry' : 'mock';

// ─── Cabeçalho: relógio, sessão ───────────────────────────────────────────
let sessionSeconds = 4 * 60 * 60;
function tick() {
  const now = new Date();
  $('#clock-time').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  $('#clock-date').textContent = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  if (sessionSeconds > 0) sessionSeconds--;
  const h = Math.floor(sessionSeconds / 3600), m = Math.floor((sessionSeconds % 3600) / 60), s = sessionSeconds % 60;
  $('#session-expire').textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
}
tick();
setInterval(tick, 1000);
$('#btn-logout').addEventListener('click', () =>
  alert('Sessão de demonstração — o encerramento de sessão não está habilitado nesta página mock.'));

$('#env-badge').textContent = [
  TELEMETRY_MODE === 'fabric' ? 'Telemetria: Fabric RTI' : 'Telemetria simulada',
  AGENT_MODE === 'foundry' ? 'Agente: Foundry' : 'Agente mock',
].join(' · ');

// ─── Cena 3D (lê o estado das máquinas a cada frame — reativa por referência) ─
const scene = initScene($('#canvas-container'), store.state.machines, { onPick: selectMachine });
store.subscribe(['selection'], (s) => scene.select(s.selectedId));

// ─── Integração de telemetria ─────────────────────────────────────────────
const source = createTelemetrySource(TELEMETRY_MODE, store.state.machines);
attachTelemetrySource(source);
setConnection({ mode: source.mode });

// ─── Componentes de UI ────────────────────────────────────────────────────
const agent = createAgent(AGENT_MODE, { snapshotOf: (id) => machineSnapshot(store.state.byId[id]) });
const assistant = mountAssistant(agent);
mountSidePanels({ source });
mountInfoPanel({ onAsk: (q) => assistant.open(q) });
mountParamsModal();

source.start({ onTelemetry: applyTelemetry, onStatus: setConnection });

// atalho para depuração/demonstração no console
window.iot = { store, source, agent };
console.log(`🏭 IoT SPA — ${store.state.machines.length} máquinas · telemetria=${TELEMETRY_MODE} · agente=${AGENT_MODE}`);
