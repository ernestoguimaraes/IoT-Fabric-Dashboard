import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { createMachines } from '../app/src/shared/machines.js';
import { store, attachTelemetrySource, applyTelemetry, sendCommand, commitParams } from '../app/src/state.js';
import { createDeviceControl, applyControlSnapshot } from '../server/deviceControl.js';
import { step, telemetrySnapshot, runningState } from '../app/src/shared/simulation.js';
import { machineSnapshot } from '../app/src/integration/agent/context.js';
import { createMockSource } from '../app/src/integration/telemetry/mock.js';

beforeEach(() => {
  const machines = createMachines();
  store.state.machines = machines;
  store.state.byId = Object.fromEntries(machines.map((m) => [m.id, m]));
  store.state.log = [];
});
afterEach(() => attachTelemetrySource(null));

test('UI command preserves a single speed increment in the separate simulator', async () => {
  const control = createDeviceControl();
  attachTelemetrySource({
    async sendCommand(id, command) { control.command(id, command); },
    async publishParams(id, params) { control.setParams(id, params); },
  });
  await sendCommand('FKL-001', 'SPEED_UP');
  const devices = createMachines();
  applyControlSnapshot(devices, control.snapshot(), new Map());
  assert.equal(store.state.byId['FKL-001'].params.speed, 110);
  assert.equal(devices.find((d) => d.id === 'FKL-001').params.speed, 110);
});

test('older telemetry cannot undo a newly requested stop, but later measured state can', async () => {
  attachTelemetrySource({
    async sendCommand() {},
    async publishParams() {},
  });
  await sendCommand('FKL-001', 'EMERGENCY_STOP');
  const m = store.state.byId['FKL-001'];
  applyTelemetry([{
    machineId: m.id, ts: new Date(m.lastControlAt - 1000).toISOString(),
    mode: 'auto', speed: 100,
  }]);
  assert.equal(m.params.mode, 'off');
  assert.equal(m.params.speed, 0);
  applyTelemetry([{
    machineId: m.id, ts: new Date(m.lastControlAt + 1000).toISOString(),
    mode: 'auto', speed: 70,
  }]);
  assert.equal(m.params.mode, 'auto');
  assert.equal(m.params.speed, 70);
});

test('measured mode and speed update UI state and command failures are surfaced', async () => {
  applyTelemetry([{ machineId: 'FKL-001', ts: new Date().toISOString(), mode: 'paused', speed: 60 }]);
  const m = store.state.byId['FKL-001'];
  assert.equal(m.params.mode, 'paused');
  assert.equal(m.params.speed, 60);
  attachTelemetrySource({
    async sendCommand() { throw new Error('Control unavailable'); },
    async publishParams() { assert.fail('Must not apply parameters after failed command'); },
  });
  await assert.rejects(sendCommand(m.id, 'RESUME'), /Control unavailable/);
  assert.equal(m.params.mode, 'paused');
  assert.match(store.state.log[0].text, /Control unavailable/);
});

test('parameter adjustments still reach the control source', async () => {
  let received;
  attachTelemetrySource({
    async publishParams(id, params) { received = { id, params }; },
  });
  const m = store.state.byId['CNC-001'];
  await commitParams(m.id, { ...m.params, targetTemp: 65 });
  assert.equal(received.id, m.id);
  assert.equal(received.params.targetTemp, 65);
});

test('simulator reports operation independently of residual usage and vibration', () => {
  const m = createMachines()[0];
  for (const [mode, speed, expected] of [
    ['auto', 100, true], ['manual', 60, true], ['auto', 0, false],
    ['paused', 100, false], ['off', 100, false],
  ]) {
    m.params = { ...m.params, mode, speed };
    assert.equal(step(m).isRunning, expected, `${mode} at ${speed}`);
  }
  assert.ok(m.usage > 0);
  m.commLost = true;
  assert.equal(step(m), null);
});

test('UI and agent keep binary operation state when a reading is missing or communication fails', () => {
  const m = store.state.byId['FKL-001'];
  assert.equal(m.isRunning, true);
  for (const isRunning of [true, false]) {
    applyTelemetry([{ machineId: m.id, isRunning, commLost: false }]);
    assert.equal(m.isRunning, isRunning);
    assert.equal(machineSnapshot(m).telemetry.isRunning, isRunning);
  }
  applyTelemetry([{ machineId: m.id, commLost: true }]);
  assert.equal(m.isRunning, false);
  assert.equal(machineSnapshot(m).telemetry.isRunning, false);
  applyTelemetry([{ machineId: m.id, commLost: false }]);
  assert.equal(m.isRunning, false);
  applyTelemetry([{ machineId: m.id, isRunning: 'false', commLost: false }]);
  assert.equal(m.isRunning, false);
});

test('initial UI, proxy devices and first telemetry agree for every machine', () => {
  const initial = store.state.machines;
  const devices = createMachines();
  const control = createDeviceControl();
  for (const m of initial) {
    const d = devices.find((device) => device.id === m.id);
    assert.equal(d.isRunning, m.isRunning, m.id);
    assert.equal(control.devices[m.id].isRunning, m.isRunning, m.id);
    const t = telemetrySnapshot(d);
    assert.equal(m.commLost, false);
    assert.equal(typeof m.isRunning, 'boolean');
    assert.equal(t.isRunning, m.isRunning, m.id);
    for (const field of ['temp', 'vib', 'usage']) assert.equal(t[field], m[field], `${m.id}.${field}`);
    assert.equal(t.mode, m.params.mode);
    assert.equal(t.speed, m.params.speed);
  }
  assert.equal(initial.filter((m) => m.isRunning === true).length, 15);
  assert.equal(initial.find((m) => m.id === 'ROB-003').isRunning, false);
});

test('initial snapshot uses the same running rule as later samples after control changes', () => {
  const m = createMachines()[0];
  for (const [mode, speed] of [['auto', 100], ['manual', 60], ['auto', 0], ['paused', 100], ['off', 100]]) {
    m.params = { ...m.params, mode, speed };
    assert.equal(telemetrySnapshot(m).isRunning, runningState(m));
    assert.equal(step(m).isRunning, telemetrySnapshot(m).isRunning);
  }
});

test('mock first delivery preserves initial readings before the first simulation step', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const machines = createMachines();
  const source = createMockSource(machines);
  const received = [];
  source.start({ onTelemetry: (items) => received.push(items) });
  t.mock.timers.tick(400);
  t.mock.timers.tick(200);
  source.stop();
  assert.equal(received.length, 1);
  assert.equal(received[0].length, 16);
  for (const item of received[0]) {
    const initial = machines.find((m) => m.id === item.machineId);
    for (const field of ['temp', 'vib', 'usage', 'isRunning']) assert.equal(item[field], initial[field]);
  }
});
