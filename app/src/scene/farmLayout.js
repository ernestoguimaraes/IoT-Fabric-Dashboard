function loop(xMin, zMin, xMax, zMax, radius, speed) {
  const segments = [];
  const line = (x1, z1, x2, z2) => segments.push({
    x1, z1, x2, z2, length: Math.hypot(x2 - x1, z2 - z1),
  });
  const arc = (x, z, angle) => segments.push({
    x, z, angle, radius, length: Math.PI * radius / 2,
  });
  line(xMin + radius, zMin, xMax - radius, zMin);
  arc(xMax - radius, zMin + radius, -Math.PI / 2);
  line(xMax, zMin + radius, xMax, zMax - radius);
  arc(xMax - radius, zMax - radius, 0);
  line(xMax - radius, zMax, xMin + radius, zMax);
  arc(xMin + radius, zMax - radius, Math.PI / 2);
  line(xMin, zMax - radius, xMin, zMin + radius);
  arc(xMin + radius, zMin + radius, Math.PI);
  return { segments, length: segments.reduce((sum, s) => sum + s.length, 0), speed };
}

export const VEHICLE_ROUTES = {
  'TRT-001': loop(-11, -8, -5, -4, 1, 0.8),
  'PUL-001': loop(-11, -0.5, -5, 2, 0.9, 0.65),
  'CAM-001': loop(3.5, 1, 16, 3.2, 1, 1),
};

export function routePose(route, distance) {
  let remaining = ((distance % route.length) + route.length) % route.length;
  for (const segment of route.segments) {
    if (remaining > segment.length) {
      remaining -= segment.length;
      continue;
    }
    const t = remaining / segment.length;
    if (segment.radius) {
      const angle = segment.angle + t * Math.PI / 2;
      return {
        x: segment.x + Math.cos(angle) * segment.radius,
        z: segment.z + Math.sin(angle) * segment.radius,
        heading: -angle - Math.PI / 2,
      };
    }
    return {
      x: segment.x1 + (segment.x2 - segment.x1) * t,
      z: segment.z1 + (segment.z2 - segment.z1) * t,
      heading: Math.atan2(segment.z1 - segment.z2, segment.x2 - segment.x1),
    };
  }
  throw new Error('Empty farm vehicle route');
}

export function hasVehicleClearance(position, radius, obstacles, gap = 0.45) {
  return obstacles.every((other) =>
    Math.hypot(position.x - other.x, position.z - other.z) >= radius + other.radius + gap);
}
