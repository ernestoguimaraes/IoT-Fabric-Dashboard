// Adaptador Fabric Real-Time Intelligence (via proxy em /api).
//   Leitura : Eventhouse (KQL) → proxy → Server-Sent Events  (/api/telemetry/stream)
//   Controle: UI → proxy HTTP → simulador (/api/params, /api/commands)
// As credenciais (SAS / Entra ID) ficam apenas no servidor.

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export function createFabricSource({ apiBase = '' } = {}) {
  let es = null;
  let handlers = {};
  let lastTs = 0;

  return {
    mode: 'fabric',
    describe() { return 'Fabric RTI · Eventhouse (KQL) via proxy'; },
    start(h) {
      handlers = h;
      handlers.onStatus?.({ status: 'connecting', detail: 'Conectando ao proxy do Fabric…' });
      es = new EventSource(`${apiBase}/api/telemetry/stream`);
      es.onopen = () => handlers.onStatus?.({ status: 'connected', detail: this.describe() });
      es.onerror = () => handlers.onStatus?.({
        status: 'error',
        detail: 'Sem conexão com o proxy /api (npm run server) — tentando reconectar…',
      });
      es.addEventListener('telemetry', (ev) => {
        const msg = JSON.parse(ev.data);
        const now = Date.now();
        const dtSec = lastTs ? (now - lastTs) / 1000 : 1;
        lastTs = now;
        handlers.onTelemetry?.(msg.items || [], { latencyMs: msg.latencyMs, dtSec });
      });
      es.addEventListener('status', (ev) => handlers.onStatus?.(JSON.parse(ev.data)));
    },
    stop() { es?.close(); },
    publishParams(machineId, params) {
      return post(`${apiBase}/api/params`, { machineId, params });
    },
    sendCommand(machineId, command) {
      return post(`${apiBase}/api/commands`, { machineId, command });
    },
  };
}
