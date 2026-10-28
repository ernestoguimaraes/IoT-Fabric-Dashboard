import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFarmAssets, farmProfile } from '../app/src/scenarios/farm.js';
import { evaluate } from '../app/src/shared/rules.js';
import { step } from '../app/src/shared/simulation.js';
import { createMachines } from '../app/src/shared/machines.js';

test('farm catalog covers field machines, herds and barns', () => {
  const assets = createFarmAssets();
  assert.equal(assets.length, 16);
  assert.deepEqual(
    [...new Set(assets.map((m) => m.family))].sort(),
    ['barn', 'field', 'herd'],
  );
  const stopped = assets.find((m) => m.id === 'TRT-002');
  assert.equal(stopped.params.mode, 'off');
  assert.equal(stopped.params.speed, 0);
  assert.equal(stopped.isRunning, false);
  assert.equal(evaluate(stopped).status, 'offline');
  assert.ok(assets.every((m) => m.location && m.metrics?.length === 3));
});

test('farm alerts fire on low fuel, fever and ammonia without changing factory machines', () => {
  const assets = createFarmAssets().map((m) => ({ ...m, ...evaluate(m) }));
  assert.equal(assets.find((m) => m.id === 'COL-001').status, 'alert');
  assert.match(assets.find((m) => m.id === 'COL-001').reasons[0].text, /Combustível/);
  assert.equal(assets.find((m) => m.id === 'BOV-002').status, 'alert');
  assert.match(assets.find((m) => m.id === 'BOV-002').reasons.map((r) => r.text).join(' '), /Temperatura/);
  assert.equal(assets.find((m) => m.id === 'SUI-003').status, 'alert');
  assert.match(assets.find((m) => m.id === 'SUI-003').reasons.map((r) => r.text).join(' '), /Amônia/);

  const factory = createMachines()[0];
  const before = { temp: factory.temp, vib: factory.vib, usage: factory.usage };
  const snap = step(factory, 1);
  assert.equal(snap.fuel, undefined);
  assert.equal(snap.nh3, undefined);
  assert.ok(Number.isFinite(snap.temp));
  assert.notDeepEqual(before, null);
});

test('running field equipment burns fuel and herd commands omit speed up', () => {
  const tractor = createFarmAssets().find((m) => m.id === 'TRT-001');
  const snap = step({ ...tractor, params: { ...tractor.params }, base: { ...tractor.base } }, 10);
  assert.ok(snap.fuel < tractor.fuel);
  assert.ok(snap.speedKmh > 0);
  const herd = farmProfile.commandsFor({ family: 'herd' }).map((c) => c.id);
  assert.equal(herd.includes('SPEED_UP'), false);
  assert.equal(herd.includes('EMERGENCY_STOP'), true);
  assert.equal(farmProfile.forceMock, true);
  assert.equal(farmProfile.commandsFor({ family: 'field' }).some((c) => c.id === 'SPEED_UP'), true);
});
