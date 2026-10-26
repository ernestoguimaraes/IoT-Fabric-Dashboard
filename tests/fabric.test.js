import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { createMachines } from '../app/src/shared/machines.js';
import { step, telemetrySnapshot } from '../app/src/shared/simulation.js';

const sent = [];
mock.module('@azure/event-hubs', {
  exports: { EventHubProducerClient: class {
    async createBatch() {
      return { events: [], tryAdd(e) { this.events.push(e); return true; } };
    }
    async sendBatch(batch) { sent.push(...batch.events); }
    async close() {}
  } },
});
mock.module('@azure/identity', {
  exports: { DefaultAzureCredential: class {
    async getToken() { return { token: 'test' }; }
  } },
});
const { publish, latestTelemetry, closeFabric } = await import('../server/fabric.js');
test('Fabric publisher accepts only telemetry and skips empty batches', async () => {
  const c = { connectionString: 'test' };
  await assert.rejects(publish([{ eventType: 'params' }], c), /somente/);
  await assert.rejects(publish([{ eventType: 'command' }], c), /somente/);
  await publish([], c);
  assert.equal(sent.length, 0);
  const e = { eventType: 'telemetry', machineId: 'FKL-001', mode: 'off', speed: 0, isRunning: false };
  await publish([e], c);
  assert.deepEqual(sent[0].body, e);
  assert.equal(sent[0].properties.eventType, 'telemetry');
  await closeFabric();
});
test('latest telemetry queries operation state with compatibility for older schemas', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const { csl } = JSON.parse(options.body);
    assert.match(csl, /column_ifexists\("isRunning", bool\(null\)\)/);
    assert.match(csl, /tobool\(column_ifexists\("isRunning", bool\(null\)\)\)/);
    assert.match(csl, /coalesce\(mode !in \("off", "paused"\) and speed > 0, false\)/);
    assert.match(csl, /arg_max\(ts, temp, vib, usage, mode, speed, isRunning, ingestedAt\)/);
    return { ok: true, json: async () => ({ Tables: [{
      Columns: ['machineId', 'mode', 'speed', 'isRunning'].map((ColumnName) => ({ ColumnName })),
      Rows: [['FKL-001', 'off', 0, false]],
    }] }) };
  };
  try {
    assert.deepEqual(await latestTelemetry({
      kustoUri: 'https://kusto.test', database: 'test', scope: 'test', telemetryTable: 'MachineTelemetry',
    }), [{ machineId: 'FKL-001', mode: 'off', speed: 0, isRunning: false }]);
  } finally { globalThis.fetch = originalFetch; }
});

test('simulator payload preserves boolean isRunning in the Event Hubs body', async () => {
  const device = createMachines()[0];
  for (const mode of ['auto', 'off']) {
    device.params.mode = mode;
    const event = {
      eventType: 'telemetry', ...step(device, 2),
      mode: device.params.mode, speed: device.params.speed,
    };
    await publish([event], { connectionString: 'test' });
    const body = JSON.parse(JSON.stringify(sent.at(-1).body));
    assert.equal(typeof body.isRunning, 'boolean');
    assert.equal(body.isRunning, mode === 'auto');
    assert.equal(body.eventType, 'telemetry');
  }
  await closeFabric();
});

test('first Fabric batch contains the same operation state and readings as the initial UI', async () => {
  const initial = createMachines();
  const events = createMachines().map(telemetrySnapshot).filter(Boolean)
    .map((reading) => ({ eventType: 'telemetry', ...reading }));
  const offset = sent.length;
  await publish(events, { connectionString: 'test' });
  const batch = sent.slice(offset);
  assert.equal(batch.length, 16);
  for (const { body } of batch) {
    const m = initial.find((device) => device.id === body.machineId);
    assert.equal(body.isRunning, m.isRunning, m.id);
    for (const field of ['temp', 'vib', 'usage']) assert.equal(body[field], m[field], `${m.id}.${field}`);
    assert.equal(body.mode, m.params.mode);
    assert.equal(body.speed, m.params.speed);
  }
  assert.equal(batch.find(({ body }) => body.machineId === 'ROB-003').body.isRunning, false);
  await closeFabric();
});
