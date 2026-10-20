// Proxy de integração: mantém credenciais no servidor e expõe uma API simples para a SPA.
//   GET  /api/health              → estado das integrações
//   GET  /api/telemetry/stream    → SSE com a última telemetria do Eventhouse (Fabric RTI)
//   POST /api/params              → publica setpoints no Eventstream
//   POST /api/commands            → publica comandos no Eventstream
//   POST /api/agent/chat          → conversa com o agente do Azure AI Foundry
import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createMachines, PARAM_KEYS, MODES } from '../app/src/shared/machines.js';
import { step } from '../app/src/shared/simulation.js';
import { fabricConfig, canPublish, canQuery, publish, latestTelemetry } from './fabric.js';
import { chat, foundryConfigured } from './foundry.js';

const PORT = Number(process.env.API_PORT || 8787);
// LOOPBACK: sem Fabric configurado, o servidor emula Eventstream+Eventhouse em memória
// (útil para testar o caminho VITE_TELEMETRY_MODE=fabric de ponta a ponta).
const LOOPBACK = process.env.FABRIC_LOOPBACK === 'true';
const KNOWN = createMachines();
const KNOWN_IDS = new Set(KNOWN.map((m) => m.id));

const app = express();
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => {
  const c = fabricConfig();
  res.json({
    ok: true,
    fabric: { eventstream: canPublish(c), eventhouse: canQuery(c), loopback: LOOPBACK, pollMs: c.pollMs },
    foundry: { configured: foundryConfigured() },
    sseClients: clients.size,
  });
});

// ─── Telemetria: um único poller compartilhado, distribuído via SSE ──────────
const clients = new Set();
let pollTimer = null;
const sse = (res, event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
const broadcast = (event, data) => clients.forEach((res) => sse(res, event, data));

const loop = { devices: Object.fromEntries(KNOWN.map((m) => [m.id, m])) };

async function pollOnce() {
  const c = fabricConfig();
  if (LOOPBACK && !canQuery(c)) {
    const items = Object.values(loop.devices).map((d) => {
      const t = step(d, c.pollMs / 1000);
      if (!t) return { machineId: d.id, commLost: true };
      Object.assign(d, { temp: t.temp, vib: t.vib, usage: t.usage });
      return { ...t, commLost: false };
    });
    broadcast('telemetry', { items, latencyMs: Math.round(40 + Math.random() * 60) });
    return;
  }
  const t0 = Date.now();
  const rows = await latestTelemetry(c);
  const queryMs = Date.now() - t0;
  const seen = new Set();
  const lags = [];
  const items = rows.filter((r) => KNOWN_IDS.has(r.machineId)).map((r) => {
    seen.add(r.machineId);
    const ts = new Date(r.ts).getTime();
    const stale = Date.now() - ts > c.staleSec * 1000;
    if (r.ingestedAt) lags.push(Math.max(0, new Date(r.ingestedAt).getTime() - ts));
    return stale
      ? { machineId: r.machineId, ts: r.ts, commLost: true }
      : { machineId: r.machineId, ts: r.ts, temp: r.temp, vib: r.vib, usage: r.usage, commLost: false };
  });
  // máquinas sem nenhuma leitura recente = perda de comunicação
  KNOWN_IDS.forEach((id) => { if (!seen.has(id)) items.push({ machineId: id, commLost: true }); });
  const ingestLag = lags.length ? lags.sort((a, b) => a - b)[Math.floor(lags.length / 2)] : 0;
  broadcast('telemetry', { items, latencyMs: ingestLag + queryMs });
}

function ensurePolling() {
  if (pollTimer || !clients.size) return;
  const c = fabricConfig();
  const tick = async () => {
    try { await pollOnce(); } catch (e) {
      console.error('[fabric] poll:', e.message);
      broadcast('status', { status: 'error', detail: `Eventhouse: ${e.message}` });
    }
  };
  tick();
  pollTimer = setInterval(tick, c.pollMs);
}

app.get('/api/telemetry/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  const c = fabricConfig();
  if (!LOOPBACK && !canQuery(c)) {
    sse(res, 'status', { status: 'error', detail: 'Fabric não configurado no proxy — defina FABRIC_KUSTO_URI/FABRIC_KUSTO_DATABASE no .env (ou FABRIC_LOOPBACK=true).' });
  } else {
    sse(res, 'status', {
      status: 'connected',
      detail: LOOPBACK && !canQuery(c) ? 'Proxy em modo loopback (Eventstream/Eventhouse emulados)' : `Eventhouse ${c.database} · ${c.telemetryTable}`,
    });
  }
  clients.add(res);
  ensurePolling();
  const ka = setInterval(() => res.write(': keep-alive\n\n'), 15000);
  req.on('close', () => {
    clearInterval(ka);
    clients.delete(res);
    if (!clients.size) { clearInterval(pollTimer); pollTimer = null; }
  });
});

// ─── Escrita: setpoints e comandos → Eventstream ─────────────────────────────
function validateParams(p) {
  if (!p || typeof p !== 'object') return 'params obrigatório';
  for (const k of PARAM_KEYS) {
    if (!(k in p)) return `params.${k} ausente`;
    if (k === 'mode' ? !(p[k] in MODES) : !Number.isFinite(p[k])) return `params.${k} inválido`;
  }
  return null;
}

const send = (fn) => async (req, res) => {
  try { res.json(await fn(req.body || {})); } catch (e) {
    console.error(`[api] ${req.path}:`, e.message);
    res.status(e.status || 500).json({ error: e.message });
  }
};
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

app.post('/api/params', send(async ({ machineId, params, ts, source }) => {
  if (!KNOWN_IDS.has(machineId)) throw bad('machineId desconhecido');
  const err = validateParams(params);
  if (err) throw bad(err);
  const evt = { eventType: 'params', machineId, ts: ts || new Date().toISOString(), source: source || 'spa', ...Object.fromEntries(PARAM_KEYS.map((k) => [k, params[k]])) };
  if (LOOPBACK && !canPublish()) { loop.devices[machineId].params = { ...params }; return { ack: true, loopback: true }; }
  await publish([evt]);
  return { ack: true };
}));

const COMMANDS = new Set(['EMERGENCY_STOP', 'PAUSE', 'RESUME', 'SPEED_UP', 'SLOW_DOWN', 'CALIBRATE', 'CYCLE_START']);
app.post('/api/commands', send(async ({ machineId, command, ts, source }) => {
  if (!KNOWN_IDS.has(machineId)) throw bad('machineId desconhecido');
  if (!COMMANDS.has(command)) throw bad('comando inválido');
  if (LOOPBACK && !canPublish()) {
    const d = loop.devices[machineId];
    if (command === 'RESUME' || command === 'CYCLE_START') d.commLost = false;
    if (command === 'CALIBRATE') d.vib *= 0.75;
    return { ack: true, loopback: true };
  }
  await publish([{ eventType: 'command', machineId, command, ts: ts || new Date().toISOString(), source: source || 'spa' }]);
  return { ack: true };
}));

// ─── Agente Foundry ──────────────────────────────────────────────────────────
app.post('/api/agent/chat', send(async ({ message, context, threadId }) => {
  if (typeof message !== 'string' || !message.trim()) throw bad('message obrigatório');
  if (message.length > 4000) throw bad('mensagem muito longa');
  return chat({ message: message.trim(), context, threadId: typeof threadId === 'string' ? threadId : undefined });
}));

app.use('/api', (_req, res) => res.status(404).json({ error: 'rota não encontrada' }));
app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.type === 'entity.parse.failed' ? 'JSON inválido' : err.message }));

// Em produção (npm run build), o mesmo servidor entrega a SPA.
const dist = fileURLToPath(new URL('../dist', import.meta.url));
if (existsSync(dist)) app.use(express.static(dist));

app.listen(PORT, () => {
  const c = fabricConfig();
  console.log(`🔌 IoT proxy em http://localhost:${PORT}`);
  console.log(`   Fabric Eventstream: ${canPublish(c) ? 'ok' : '—'} · Eventhouse: ${canQuery(c) ? 'ok' : '—'}${LOOPBACK ? ' · loopback ATIVO' : ''}`);
  console.log(`   Foundry agent: ${foundryConfigured() ? 'ok' : '—'}`);
});
