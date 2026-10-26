import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, mock, test } from 'node:test';
import { createMachines } from '../app/src/shared/machines.js';
import { step } from '../app/src/shared/simulation.js';
import { createDeviceControl, applyControlSnapshot } from '../server/deviceControl.js';

mock.module('../server/fabric.js', {
  exports: {
    fabricConfig: () => ({ pollMs: 50 }),
    canPublish: () => false,
    canQuery: () => false,
    latestTelemetry: () => { throw new Error('Loopback must not query Fabric'); },
    getCredential: () => { throw new Error('Control must not authenticate with Azure'); },
  },
});
process.env.API_PORT = '0';
process.env.FABRIC_LOOPBACK = 'true';
const { server } = await import('../server/index.js');
if (!server.listening) await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
after(() => new Promise((resolve, reject) => {
  server.close((err) => err ? reject(err) : resolve());
  server.closeIdleConnections();
}));

async function post(path, body) {
  return fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('HTTP control stops and resumes a separate simulator without Fabric publication', async () => {
  const devices = createMachines();
  const applied = new Map();
  const stop = await post('/api/commands', { machineId: 'FKL-001', command: 'EMERGENCY_STOP' });
  assert.equal(stop.status, 200);
  assert.deepEqual(await stop.json(), { ack: true, delivery: 'local-control' });
  applyControlSnapshot(devices, await (await fetch(`${base}/api/devices/control`)).json(), applied);
  const forklift = devices.find((d) => d.id === 'FKL-001');
  assert.equal(forklift.params.mode, 'off');
  assert.equal(forklift.params.speed, 0);
  const telemetry = { eventType: 'telemetry', ...step(forklift), mode: forklift.params.mode, speed: forklift.params.speed };
  assert.equal(telemetry.eventType, 'telemetry');
  assert.equal(telemetry.mode, 'off');
  assert.equal(telemetry.speed, 0);
  assert.equal(telemetry.isRunning, false);
  assert.equal(typeof telemetry.temp, 'number');
  assert.equal(telemetry.command, undefined);

  assert.equal((await post('/api/commands', { machineId: 'FKL-001', command: 'RESUME' })).status, 200);
  applyControlSnapshot(devices, await (await fetch(`${base}/api/devices/control`)).json(), applied);
  assert.equal(forklift.params.mode, 'auto');
  assert.equal(forklift.params.speed, forklift.defaults.speed);
  assert.equal(step(forklift).isRunning, true);
});

test('parameter adjustments reach the simulated device over HTTP', async () => {
  const devices = createMachines();
  const device = devices.find((d) => d.id === 'CNC-001');
  const params = { ...device.params, speed: 65, targetTemp: 60 };
  assert.equal((await post('/api/params', { machineId: device.id, params })).status, 200);
  const response = await fetch(`${base}/api/devices/control`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  applyControlSnapshot(devices, await response.json(), new Map());
  assert.deepEqual(device.params, params);
});

test('invalid commands, machine IDs and parameter modes are rejected', async () => {
  assert.equal((await post('/api/commands', { machineId: 'FKL-001', command: 'INVALID' })).status, 400);
  assert.equal((await post('/api/commands', { machineId: 'INVALID', command: 'PAUSE' })).status, 400);
  assert.equal((await post('/api/params', { machineId: 'CNC-001', params: {} })).status, 400);
  const params = { ...createMachines()[0].params, mode: 'toString' };
  assert.equal((await post('/api/params', { machineId: 'CNC-001', params })).status, 400);
});

test('calibration applies once per revision and survives skipped control snapshots', () => {
  const control = createDeviceControl();
  const devices = createMachines();
  const applied = new Map();
  const d = devices[0];
  const initialVib = d.vib;
  control.command(d.id, 'CALIBRATE');
  control.command(d.id, 'CALIBRATE');
  applyControlSnapshot(devices, control.snapshot(), applied);
  assert.equal(d.vib, initialVib * 0.75 ** 2);
  applyControlSnapshot(devices, control.snapshot(), applied);
  assert.equal(d.vib, initialVib * 0.75 ** 2);
  control.setParams(d.id, { ...d.params, speed: 80 });
  applyControlSnapshot(devices, control.snapshot(), applied);
  assert.equal(d.vib, initialVib * 0.75 ** 2);
  assert.equal(d.params.speed, 80);
});

test('resume reconnects an offline device and a proxy restart restores defaults', () => {
  const control = createDeviceControl();
  const devices = createMachines();
  const applied = new Map();
  const robot = devices.find((d) => d.id === 'ROB-003');
  control.devices[robot.id].commLost = true;
  applyControlSnapshot(devices, control.snapshot(), applied);
  assert.equal(robot.commLost, true);
  control.command(robot.id, 'RESUME');
  applyControlSnapshot(devices, control.snapshot(), applied);
  assert.equal(robot.commLost, false);
  assert.equal(robot.params.speed, 100);
  control.command(devices[0].id, 'EMERGENCY_STOP');
  applyControlSnapshot(devices, control.snapshot(), applied);
  assert.equal(devices[0].params.mode, 'off');
  applyControlSnapshot(devices, createDeviceControl().snapshot(), applied);
  assert.equal(devices[0].params.mode, 'auto');
  assert.equal(robot.commLost, false);
  assert.equal(robot.params.mode, 'off');
  assert.equal(robot.params.speed, 0);
});

test('loopback SSE reports the resulting mode and speed', async () => {
  await post('/api/commands', { machineId: 'FKL-002', command: 'EMERGENCY_STOP' });
  const abort = new AbortController();
  const response = await fetch(`${base}/api/telemetry/stream`, { signal: abort.signal });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  try {
    while (!text.includes('event: telemetry')) {
      const { value, done } = await reader.read();
      assert.equal(done, false);
      text += decoder.decode(value, { stream: true });
    }
    const match = /event: telemetry\ndata: (.+)\n/.exec(text);
    assert.ok(match);
    const d = JSON.parse(match[1]).items.find((item) => item.machineId === 'FKL-002');
    assert.equal(d.mode, 'off');
    assert.equal(d.speed, 0);
    assert.equal(d.isRunning, false);
    const initial = createMachines().find((device) => device.id === d.machineId);
    for (const field of ['temp', 'vib', 'usage']) assert.equal(d[field], initial[field]);
  } finally {
    abort.abort();
    await reader.cancel().catch((e) => {
      if (e.name !== 'AbortError') throw e;
    });
  }
});
