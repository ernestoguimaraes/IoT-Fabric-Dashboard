// Cliente Fabric Real-Time Intelligence.
//   • Escrita: Eventstream (custom endpoint, protocolo Event Hubs) via @azure/event-hubs.
//   • Leitura: Eventhouse / KQL Database via REST (/v1/rest/query) com token Entra ID.
import { EventHubProducerClient } from '@azure/event-hubs';
import { DefaultAzureCredential } from '@azure/identity';

const env = (k, d) => process.env[k] || d;

export const fabricConfig = () => ({
  connectionString: env('FABRIC_EVENTSTREAM_CONNECTION_STRING'),
  eventHubName: env('FABRIC_EVENTSTREAM_NAME'),
  kustoUri: env('FABRIC_KUSTO_URI')?.replace(/\/$/, ''),
  database: env('FABRIC_KUSTO_DATABASE'),
  scope: env('FABRIC_KUSTO_SCOPE', 'https://kusto.kusto.windows.net/.default'),
  telemetryTable: env('FABRIC_TELEMETRY_TABLE', 'MachineTelemetry'),
  paramsTable: env('FABRIC_PARAMS_TABLE', 'MachineParams'),
  pollMs: Number(env('FABRIC_POLL_MS', 2000)),
  staleSec: Number(env('FABRIC_STALE_SEC', 15)),
});

export const canPublish = (c = fabricConfig()) => !!c.connectionString;
export const canQuery = (c = fabricConfig()) => !!(c.kustoUri && c.database);

let credential;
export const getCredential = () => (credential ??= new DefaultAzureCredential());

let producer;
function getProducer(c) {
  if (!producer) {
    producer = c.eventHubName
      ? new EventHubProducerClient(c.connectionString, c.eventHubName)
      : new EventHubProducerClient(c.connectionString); // EntityPath já vem na connection string
  }
  return producer;
}

/** Publica eventos no Eventstream. Cada evento leva `eventType` para roteamento (telemetry|params|command). */
export async function publish(events, c = fabricConfig()) {
  if (!canPublish(c)) throw Object.assign(new Error('Eventstream não configurado (FABRIC_EVENTSTREAM_CONNECTION_STRING).'), { status: 503 });
  const p = getProducer(c);
  const batch = await p.createBatch();
  for (const e of events) {
    if (!batch.tryAdd({ body: e, contentType: 'application/json', properties: { eventType: e.eventType, machineId: e.machineId } })) {
      throw new Error('Evento excede o tamanho máximo do lote.');
    }
  }
  await p.sendBatch(batch);
}

/** Executa uma consulta KQL e devolve a primeira tabela como array de objetos. */
export async function kql(csl, c = fabricConfig()) {
  if (!canQuery(c)) throw Object.assign(new Error('Eventhouse não configurado (FABRIC_KUSTO_URI / FABRIC_KUSTO_DATABASE).'), { status: 503 });
  const { token } = await getCredential().getToken(c.scope);
  const res = await fetch(`${c.kustoUri}/v1/rest/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' },
    body: JSON.stringify({ db: c.database, csl }),
  });
  if (!res.ok) throw new Error(`KQL ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const t = data.Tables?.[0];
  if (!t) return [];
  const cols = t.Columns.map((x) => x.ColumnName);
  return t.Rows.map((r) => Object.fromEntries(cols.map((k, i) => [k, r[i]])));
}

/** Última leitura de cada máquina (últimos 10 min) + horário de ingestão para medir latência. */
export function latestTelemetry(c = fabricConfig()) {
  return kql(`${c.telemetryTable}
| where ts > ago(10m)
| extend ingestedAt = ingestion_time()
| summarize arg_max(ts, temp, vib, usage, ingestedAt) by machineId`, c);
}

/** Setpoints desejados mais recentes (publicados pela SPA) — usados pelo simulador de dispositivos. */
export function latestParams(c = fabricConfig()) {
  return kql(`${c.paramsTable}
| summarize arg_max(ts, *) by machineId`, c);
}

export async function closeFabric() { await producer?.close(); producer = undefined; }
