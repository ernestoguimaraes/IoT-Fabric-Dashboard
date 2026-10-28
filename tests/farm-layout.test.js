import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { VEHICLE_ROUTES, routePose, hasVehicleClearance } from '../app/src/scene/farmLayout.js';
import { createFarmWheels, rollFarmWheels } from '../app/src/scene/farmWheels.js';
import { createFarmAssets } from '../app/src/scenarios/farm.js';

const radii = {
  tractor: 1.15, sprayer: 1.5, truck: 1.65, harvester: 1.7,
  pivot: 4.5, cattle: 1.8, sheep: 1.8, barn: 1.7, silo: 1.1, piggery: 1.5,
};
const samples = (route) => Array.from({ length: 400 }, (_, i) =>
  routePose(route, route.length * i / 400));

test('farm wheels have transverse axles, ground contact and distance-based rolling', () => {
  const materials = { rubber: new THREE.MeshBasicMaterial(), hub: new THREE.MeshBasicMaterial() };
  const wheels = createFarmWheels([
    { x: -0.45, radius: 0.48, width: 0.22 },
    { x: 0.48, radius: 0.3, width: 0.18 },
  ], 0.98, materials);
  assert.equal(wheels.length, 4);
  for (const wheel of wheels) {
    const bounds = new THREE.Box3().setFromObject(wheel);
    const size = bounds.getSize(new THREE.Vector3());
    assert.ok(Math.abs(bounds.min.y) < 1e-6);
    assert.ok(Math.abs(size.x - size.y) < 1e-6);
    assert.ok(size.z < size.x);
    const axle = new THREE.Vector3(0, 1, 0).applyQuaternion(wheel.children[0].quaternion);
    assert.ok(Math.abs(axle.z) > 0.999);
  }
  rollFarmWheels(wheels, 0);
  assert.equal(wheels[0].rotation.z, 0);
  rollFarmWheels(wheels, 0.48);
  assert.equal(wheels[0].rotation.z, -1);
  assert.equal(wheels[0].rotation.x, 0);
  for (const wheel of wheels) for (const child of wheel.children) child.geometry.dispose();
  Object.values(materials).forEach((material) => material.dispose());
});

test('vehicle routes close smoothly and start at their catalog location', () => {
  const assets = createFarmAssets();
  for (const [id, route] of Object.entries(VEHICLE_ROUTES)) {
    const first = routePose(route, 0);
    const last = routePose(route, route.length);
    assert.deepEqual(first, last);
    const asset = assets.find((m) => m.id === id);
    assert.deepEqual(asset.pos, [first.x, 0, first.z]);
    for (let distance = 0; distance < route.length; distance += 0.05) {
      const current = routePose(route, distance);
      const next = routePose(route, distance + 0.01);
      assert.ok(Math.hypot(next.x - current.x, next.z - current.z) <= 0.010001);
      const turn = Math.atan2(Math.sin(next.heading - current.heading), Math.cos(next.heading - current.heading));
      assert.ok(Math.abs(turn) < 0.012);
    }
  }
});

test('every vehicle route clears parked equipment, irrigation and farm installations', () => {
  const assets = createFarmAssets();
  for (const [id, route] of Object.entries(VEHICLE_ROUTES)) {
    const vehicle = assets.find((m) => m.id === id);
    const obstacles = assets.filter((m) => !VEHICLE_ROUTES[m.id]).map((m) => ({
      x: m.pos[0], z: m.pos[2], radius: radii[m.type],
    }));
    for (const pose of samples(route)) {
      assert.ok(hasVehicleClearance(pose, radii[vehicle.type], obstacles), `${id} near an installation`);
    }
  }
});

test('separate vehicle circuits cannot collide even with different speeds or stopped traffic', () => {
  const routes = Object.entries(VEHICLE_ROUTES);
  const assets = createFarmAssets();
  for (let i = 0; i < routes.length; i++) {
    const [id, route] = routes[i];
    const radius = radii[assets.find((m) => m.id === id).type];
    for (const [otherId, otherRoute] of routes.slice(i + 1)) {
      const otherRadius = radii[assets.find((m) => m.id === otherId).type];
      const obstacles = samples(otherRoute).map((other) => ({ ...other, radius: otherRadius }));
      for (const pose of samples(route)) {
        assert.ok(hasVehicleClearance(pose, radius, obstacles), `${id} overlaps ${otherId}`);
      }
    }
  }
  assert.equal(hasVehicleClearance({ x: 0, z: 0 }, 1, [{ x: 1.5, z: 0, radius: 1 }]), false);
  assert.equal(hasVehicleClearance({ x: 0, z: 0 }, 1, [{ x: 3, z: 0, radius: 1 }]), true);
});
