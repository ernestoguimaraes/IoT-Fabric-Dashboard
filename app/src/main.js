// Ponto de entrada da SPA: cena 3D + store reativo + integrações (Fabric RTI / Foundry).
import { $, pad, toast } from './ui/dom.js';
import { store, selectMachine, closeEditor, attachTelemetrySource, applyTelemetry, setConnection, resetScenario } from './state.js';
import { initScene } from './scene/scene.js';
import { initFarmScene } from './scene/farm.js';
import { createTelemetrySource } from './integration/telemetry/index.js';
import { createAgent } from './integration/agent/index.js';
import { machineSnapshot } from './integration/agent/context.js';
import { mountSidePanels, hydrateChrome } from './ui/sidePanels.js';
import { mountInfoPanel } from './ui/infoPanel.js';
import { mountParamsModal } from './ui/paramsModal.js';
import { mountAssistant } from './ui/assistant.js';
import { readScenarioId, saveScenarioId, setActiveScenario } from './scenarios/index.js';

const ENV_TELEMETRY = import.meta.env.VITE_TELEMETRY_MODE === 'fabric' ? 'fabric' : 'mock';
const ENV_AGENT = import.meta.env.VITE_AGENT_MODE || 'mock';

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

let scene = null;
let source = null;
let agent = null;
let switching = false;

const assistant = mountAssistant({
  mode: 'mock', label: 'Agente local (mock)', reset() {},
  async send() { return { text: 'Aguarde o cenário carregar.' }; },
});
const panels = mountSidePanels({ source: { mode: 'mock' } });
mountInfoPanel({ onAsk: (q) => assistant.open(q) });
mountParamsModal();
store.subscribe(['selection'], (s) => scene?.select(s.selectedId));

function modesFor(profile) {
  return {
    telemetry: profile.forceMock ? 'mock' : ENV_TELEMETRY,
    agent: profile.forceMock ? 'mock' : ENV_AGENT,
  };
}

async function activate(id) {
  if (switching) return;
  switching = true;
  const select = $('#scenario-select');
  select.disabled = true;
  try {
    source?.stop?.();
    scene?.dispose?.();
    $('#canvas-container').replaceChildren();
    closeEditor();
    selectMachine(null);
    const profile = setActiveScenario(id);
    saveScenarioId(profile.id);
    const modes = modesFor(profile);
    resetScenario(profile.createAssets(), profile.initialKpis, {
      scenario: profile.id, plant: profile.plant, operator: profile.operator,
    });
    hydrateChrome(profile);
    $('#env-badge').textContent = profile.envBadge(modes.telemetry, modes.agent);
    const boot = profile.id === 'farm' ? initFarmScene : initScene;
    scene = boot($('#canvas-container'), store.state.machines, { onPick: selectMachine });
    source = createTelemetrySource(modes.telemetry, store.state.machines);
    panels.setSource(source);
    attachTelemetrySource(source);
    setConnection({ mode: source.mode, status: 'connecting', detail: '' });
    agent = createAgent(modes.agent, {
      snapshotOf: (mid) => machineSnapshot(store.state.byId[mid]),
      kb: profile.kb,
      assistant: profile.assistant,
    });
    assistant.bind(agent);
    source.start({ onTelemetry: applyTelemetry, onStatus: setConnection });
    window.iot = { store, get source() { return source; }, get agent() { return agent; }, activate };
    console.log(`${profile.id === 'farm' ? '🌾' : '🏭'} IoT SPA — ${store.state.machines.length} ativos · ${profile.id} · telemetria=${modes.telemetry} · agente=${modes.agent}`);
  } catch (e) {
    console.error(e);
    toast(`Não foi possível trocar a simulação: ${e.message}`, 'err');
  } finally {
    switching = false;
    select.disabled = false;
    select.value = store.state.scenario;
  }
}

$('#scenario-select').addEventListener('change', (e) => {
  if (e.target.value !== store.state.scenario) activate(e.target.value);
});

activate(readScenarioId());
