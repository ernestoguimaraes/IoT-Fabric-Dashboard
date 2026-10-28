import * as THREE from 'three';

export function createFarmWheels(axles, track, { rubber, hub }) {
  return axles.flatMap(({ x, radius, width }) => [-1, 1].map((side) => {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 24), rubber);
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.45, radius * 0.45, width + 0.025, 16), hub);
    tire.rotation.x = rim.rotation.x = Math.PI / 2;
    wheel.add(tire, rim);
    wheel.position.set(x, radius, side * track / 2);
    wheel.userData.radius = radius;
    return wheel;
  }));
}

export function rollFarmWheels(wheels, distance) {
  for (const wheel of wheels) wheel.rotation.z -= distance / wheel.userData.radius;
}
