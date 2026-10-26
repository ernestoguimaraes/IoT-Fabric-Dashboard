// Simulador de dispositivos IoT → Fabric Eventstream.
// Controle: SPA → proxy HTTP → simulador. Estado: simulador → Eventstream → Eventhouse.
//
//   npm run simulate:devices
import { createMachines } from '../app/src/shared/machines.js';
import { step, telemetrySnapshot } from '../app/src/shared/simulation.js';
import { fabricConfig, canPublish, publish, closeFabric } from './fabric.js';
import { applyControlSnapshot } from './deviceControl.js';

const c = fabricConfig();
if (!canPublish(c)) {
  console.error('Defina FABRIC_EVENTSTREAM_CONNECTION_STRING no .env para enviar telemetria ao Eventstream.');
  process.exit(1);
}

const INTERVAL_MS = Number(process.env.DEVICE_INTERVAL_MS || 2000);
const devices = createMachines();
const lastApplied = new Map();
let loggedPayload = false;
let initialSample = true;
const controlUrl = `${(process.env.DEVICE_CONTROL_URL || `http://localhost:${process.env.API_PORT || 8787}`).replace(/\/$/, '')}/api/devices/control`;

async function syncParams() {
  try {
    const res = await fetch(controlUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    applyControlSnapshot(devices, await res.json(), lastApplied);
  } catch (e) { console.warn('[control] Falha ao buscar controle; mantendo ultimo estado:', e.message); }
}

async function tick() {
  await syncParams();
  const events = devices.map((d) => initialSample ? telemetrySnapshot(d) : step(d, INTERVAL_MS / 1000)).filter(Boolean).map((t) => {
    const d = devices.find((x) => x.id === t.machineId);
    Object.assign(d, { temp: t.temp, vib: t.vib, usage: t.usage, isRunning: t.isRunning });
    return { eventType: 'telemetry', ...t };
  });
  initialSample = false;
  try {
    await publish(events, c);
    if (!loggedPayload && events.length) {
      console.log('[telemetry] Exemplo de payload aceito pelo endpoint:', JSON.stringify(events[0]));
      loggedPayload = true;
    }
    process.stdout.write(`\r📡 ${new Date().toLocaleTimeString('pt-BR')} · ${events.length} leituras enviadas   `);
  } catch (e) { console.error('\n[telemetry]', e.message); }
}

console.log(`Simulando ${devices.length} dispositivos a cada ${INTERVAL_MS} ms → Eventstream; controle HTTP: ${controlUrl}`);
let stopping = false;
let timer;
async function run() {
  await tick();
  if (!stopping) timer = setTimeout(run, INTERVAL_MS);
}
await run();
process.on('SIGINT', async () => { stopping = true; clearTimeout(timer); await closeFabric(); process.exit(0); });
