// Simulador de dispositivos IoT → Fabric Eventstream.
// Envia telemetria de todas as máquinas e aplica os setpoints desejados lidos do Eventhouse
// (tabela MachineParams), fechando o ciclo: SPA → Eventstream → Eventhouse → dispositivo.
//
//   npm run simulate:devices
import { createMachines } from '../app/src/shared/machines.js';
import { step } from '../app/src/shared/simulation.js';
import { fabricConfig, canPublish, canQuery, publish, latestParams, closeFabric } from './fabric.js';

const c = fabricConfig();
if (!canPublish(c)) {
  console.error('Defina FABRIC_EVENTSTREAM_CONNECTION_STRING no .env para enviar telemetria ao Eventstream.');
  process.exit(1);
}

const INTERVAL_MS = Number(process.env.DEVICE_INTERVAL_MS || 2000);
const devices = createMachines();
const lastApplied = {};

async function syncParams() {
  if (!canQuery(c)) return;
  try {
    for (const r of await latestParams(c)) {
      const d = devices.find((x) => x.id === r.machineId);
      if (!d || lastApplied[d.id] === r.ts) continue;
      lastApplied[d.id] = r.ts;
      for (const k of Object.keys(d.params)) if (r[k] !== undefined && r[k] !== null) d.params[k] = r[k];
      if (d.params.mode !== 'off') d.commLost = false;
      console.log(`⚙️  ${d.id} recebeu setpoints`, d.params);
    }
  } catch (e) { console.warn('[params]', e.message); }
}

async function tick() {
  const events = devices.map((d) => step(d, INTERVAL_MS / 1000)).filter(Boolean).map((t) => {
    const d = devices.find((x) => x.id === t.machineId);
    Object.assign(d, { temp: t.temp, vib: t.vib, usage: t.usage });
    return { eventType: 'telemetry', ...t, mode: d.params.mode, speed: d.params.speed };
  });
  try {
    await publish(events, c);
    process.stdout.write(`\r📡 ${new Date().toLocaleTimeString('pt-BR')} · ${events.length} leituras enviadas   `);
  } catch (e) { console.error('\n[telemetry]', e.message); }
}

console.log(`Simulando ${devices.length} dispositivos a cada ${INTERVAL_MS} ms → Eventstream${canQuery(c) ? ' (lendo MachineParams do Eventhouse)' : ''}`);
await syncParams();
setInterval(tick, INTERVAL_MS);
setInterval(syncParams, 5000);
process.on('SIGINT', async () => { await closeFabric(); process.exit(0); });
