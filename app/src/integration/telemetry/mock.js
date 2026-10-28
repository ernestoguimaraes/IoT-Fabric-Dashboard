// Simulador local dos dispositivos IoT (modo padrão).
// Mantém um "gêmeo" de cada máquina, separado do estado da UI: os setpoints
// so chegam ao dispositivo pelo canal de controle, separado da telemetria.
import { step, telemetrySnapshot } from '../../shared/simulation.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (o) => JSON.parse(JSON.stringify(o));

export function createMockSource(machines, { intervalMs = 1000 } = {}) {
  const extras = ['fuel', 'humidity', 'nh3', 'activity', 'outside', 'speedKmh', 'headcount'];
  const devices = Object.fromEntries(machines.map((m) => [m.id, clone({
    id: m.id, params: m.params, defaults: m.defaults, base: m.base,
    temp: m.temp, vib: m.vib, usage: m.usage, commLost: m.commLost,
    ...Object.fromEntries(extras.filter((k) => m[k] != null).map((k) => [k, m[k]])),
  })]));
  let timer = null;
  let boot = null;
  let handlers = {};
  let initialSample = true;
  const reconnecting = new Set();

  function tick() {
    const t0 = performance.now();
    const items = [];
    for (const d of Object.values(devices)) {
      const t = initialSample ? telemetrySnapshot(d) : step(d, intervalMs / 1000);
      if (!t) continue;
      const live = { temp: t.temp, vib: t.vib, usage: t.usage };
      for (const k of ['fuel', 'humidity', 'nh3', 'activity', 'outside', 'speedKmh', 'headcount']) {
        if (t[k] !== undefined) live[k] = t[k];
      }
      Object.assign(d, live);
      items.push({ ...t, commLost: false });
    }
    initialSample = false;
    // latência simulada do caminho dispositivo → Eventstream → Eventhouse → UI
    const latencyMs = Math.round(60 + Math.random() * 110);
    setTimeout(() => handlers.onTelemetry?.(items, { latencyMs, dtSec: intervalMs / 1000, t0 }), latencyMs);
  }

  return {
    mode: 'mock',
    describe() {
      return 'Simulador local · pipeline Eventstream → Eventhouse emulado';
    },
    start(h) {
      handlers = h;
      initialSample = true;
      handlers.onStatus?.({ status: 'connecting', detail: 'Iniciando simulador de dispositivos…' });
      boot = setTimeout(() => {
        boot = null;
        handlers.onStatus?.({ status: 'connected', detail: this.describe() });
        tick();
        timer = setInterval(tick, intervalMs);
      }, 400);
    },
    stop() { clearTimeout(boot); clearInterval(timer); timer = null; boot = null; },
    async publishParams(machineId, params) {
      await delay(120 + Math.random() * 180);
      const d = devices[machineId];
      if (!d) throw new Error(`dispositivo ${machineId} desconhecido`);
      d.params = clone(params);
      return { ack: true };
    },
    async sendCommand(machineId, cmd) {
      await delay(80 + Math.random() * 120);
      const d = devices[machineId];
      if (!d) throw new Error(`dispositivo ${machineId} desconhecido`);
      if ((cmd === 'RESUME' || cmd === 'CYCLE_START') && d.commLost && !reconnecting.has(machineId)) {
        reconnecting.add(machineId);
        setTimeout(() => { d.commLost = false; reconnecting.delete(machineId); }, 1500);
      }
      if (cmd === 'CALIBRATE') {
        d.vib *= 0.75;
        if (d.outside != null) d.outside = Math.max(0, d.outside - 1);
      }
      return { ack: true };
    },
  };
}
