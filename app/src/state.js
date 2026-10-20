// Estado da aplicação + ações (única forma de alterar o store).
import { createStore } from './store.js';
import { createMachines, MODES } from './shared/machines.js';
import { evaluate } from './shared/rules.js';

const machines = createMachines();
machines.forEach((m) => Object.assign(m, evaluate(m)));

export const store = createStore({
  machines,
  byId: Object.fromEntries(machines.map((m) => [m.id, m])),
  selectedId: null,
  editingId: null,
  log: [],
  kpis: { pieces: 14820, commands: 7, paramChanges: 0, unplanned: 2 },
  connection: {
    mode: 'mock', status: 'connecting', detail: '', lastSync: null,
    latencyMs: null, eventsIn: 0, eventsOut: 0,
  },
});

let source = null;
export function attachTelemetrySource(s) { source = s; }

const now = () => new Date();

function addLog(entry) {
  store.state.log.unshift({ ts: now(), ...entry });
  store.state.log.length = Math.min(store.state.log.length, 60);
}

function reevaluate(m) {
  const prev = m.status;
  Object.assign(m, evaluate(m));
  if (prev !== m.status) {
    addLog({ kind: 'status', machineId: m.id, text: `${m.id}: ${labelOf(prev)} → ${labelOf(m.status)}` });
    if (m.status === 'offline' && prev !== 'offline') store.state.kpis.unplanned += m.params.mode === 'off' ? 0 : 1;
    return true;
  }
  return false;
}
const labelOf = (s) => ({ online: 'Online', alert: 'Alerta', offline: 'Offline' }[s] || s);

// ─── Seleção ────────────────────────────────────────────────────────────────
export function selectMachine(id) {
  store.update('selection', (s) => { s.selectedId = id; });
}
export function openEditor(id) {
  store.update('selection', (s) => { s.editingId = id; s.selectedId = id; });
}
export function closeEditor() {
  store.update('selection', (s) => { s.editingId = null; });
}

// ─── Telemetria (vinda do Fabric RTI ou do simulador) ───────────────────────
export function applyTelemetry(items, meta = {}) {
  const topics = new Set(['machines', 'kpis']);
  const { byId } = store.state;
  for (const t of items) {
    const m = byId[t.machineId];
    if (!m) continue;
    if (t.commLost !== undefined) m.commLost = !!t.commLost;
    if (t.temp !== undefined) { m.temp = +t.temp; m.vib = +t.vib; m.usage = +t.usage; }
    if (!m.commLost) m.lastSeen = t.ts ? new Date(t.ts).getTime() : Date.now();
    if (reevaluate(m)) topics.add('log');
    topics.add(`machine:${m.id}`);
  }
  store.update([...topics, 'connection'], (s) => {
    s.connection.lastSync = now();
    s.connection.eventsIn += items.length;
    if (meta.latencyMs != null) s.connection.latencyMs = meta.latencyMs;
    // produção acumulada: cada máquina em operação conclui ciclos proporcionais à velocidade
    const dt = meta.dtSec || 1;
    s.kpis.pieces += s.machines.reduce((acc, m) => (m.status === 'offline' || m.params.mode === 'paused')
      ? acc : acc + (dt / m.params.cycleTime) * (m.params.speed / 100) * 6, 0);
  });
}

export function setConnection(patch) {
  store.update('connection', (s) => Object.assign(s.connection, patch));
}

// ─── Parâmetros ─────────────────────────────────────────────────────────────
// preview: reflete imediatamente na UI/cena (limites, modo, velocidade) sem publicar no dispositivo.
export function previewParams(id, params) {
  const m = store.state.byId[id];
  if (!m) return;
  Object.assign(m.params, params);
  reevaluate(m);
  store.update(['machines', `machine:${id}`, 'log']);
}

export async function commitParams(id, params, { origin = 'Ajuste de parâmetros', prev } = {}) {
  const m = store.state.byId[id];
  if (!m) return;
  const before = prev || { ...m.params };
  Object.assign(m.params, params);
  reevaluate(m);
  const diff = Object.keys(params).filter((k) => before[k] !== params[k]);
  const text = diff.length
    ? diff.map((k) => `${k}: ${fmtParam(k, before[k])} → ${fmtParam(k, params[k])}`).join(' · ')
    : 'sem alterações';
  addLog({ kind: 'params', machineId: id, text: `${id} · ${origin}: ${text}` });
  store.update(['machines', `machine:${id}`, 'log', 'kpis'], (s) => { if (diff.length) s.kpis.paramChanges++; });
  if (!source) return;
  try {
    await source.publishParams(id, { ...m.params });
    store.update('connection', (s) => { s.connection.eventsOut++; });
  } catch (e) {
    addLog({ kind: 'error', machineId: id, text: `Falha ao sincronizar parâmetros de ${id}: ${e.message}` });
    store.update('log');
    throw e;
  }
}

const fmtParam = (k, v) => (k === 'mode' ? MODES[v] || v : v);

// ─── Comandos (mesmos da v2), agora com efeito real no estado ───────────────
export async function sendCommand(id, cmd) {
  const m = store.state.byId[id];
  if (!m) return;
  const p = { ...m.params };
  switch (cmd) {
    case 'EMERGENCY_STOP': p.mode = 'off'; p.speed = 0; break;
    case 'PAUSE': p.mode = 'paused'; break;
    case 'RESUME': p.mode = 'auto'; if (!p.speed) p.speed = m.defaults.speed; break;
    case 'CYCLE_START': p.mode = 'auto'; if (!p.speed) p.speed = m.defaults.speed; break;
    case 'SPEED_UP': p.speed = Math.min(130, p.speed + 10); break;
    case 'SLOW_DOWN': p.speed = Math.max(0, p.speed - 10); break;
    default: break;
  }
  store.update('kpis', (s) => { s.kpis.commands++; });
  if (source?.sendCommand) {
    source.sendCommand(id, cmd).then(() => store.update('connection', (s) => { s.connection.eventsOut++; }))
      .catch((e) => { addLog({ kind: 'error', machineId: id, text: `Falha no comando ${cmd}: ${e.message}` }); store.update('log'); });
  }
  await commitParams(id, p, { origin: `Comando ${cmd}` });
}
