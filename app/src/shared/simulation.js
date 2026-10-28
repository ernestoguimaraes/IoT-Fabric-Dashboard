// Modelo físico simplificado de um dispositivo IoT: a telemetria converge
// para um ponto de equilíbrio definido pelos setpoints (+ ruído de sensor).
// Compartilhado entre o simulador do navegador e o simulador de dispositivos (Node).

export function effectiveSpeed(m) {
  const { mode, speed } = m.params;
  if (mode === 'off' || mode === 'paused') return 0;
  return speed;
}

export function runningState(m) {
  return !m.commLost && effectiveSpeed(m) > 0;
}

const EXTRA_KEYS = ['fuel', 'humidity', 'nh3', 'activity', 'outside', 'speedKmh', 'headcount'];

function withExtras(m, snap) {
  for (const k of EXTRA_KEYS) if (m[k] != null) snap[k] = m[k];
  return snap;
}

export function telemetrySnapshot(m) {
  if (m.commLost) return null;
  return withExtras(m, {
    machineId: m.id,
    ts: new Date().toISOString(),
    temp: m.temp,
    vib: m.vib,
    usage: m.usage,
    mode: m.params.mode,
    speed: m.params.speed,
    isRunning: runningState(m),
  });
}

export function equilibrium(m) {
  const s = effectiveSpeed(m) / 100;
  const { targetTemp, cycleTime, mode } = m.params;
  const cycle = Number.isFinite(cycleTime) ? cycleTime : (m.defaults?.cycleTime || 30);
  const c = Math.sqrt((m.defaults?.cycleTime || cycle) / cycle);
  const ambient = 25;
  let temp;
  if (mode === 'off') temp = ambient;
  else if (mode === 'paused') temp = ambient + (targetTemp - ambient) * 0.5;
  else temp = ambient + (targetTemp - ambient) * (0.55 + 0.45 * s * Math.min(c, 1.3));
  const vib = m.base.vib * Math.pow(s, 1.3) * Math.pow(c, 0.6);
  const usage = Math.min(100, m.base.usage * s * c);
  return { temp, vib, usage };
}

const noise = (amp) => (Math.random() - 0.5) * 2 * amp;
const round1 = (n) => Math.round(n * 10) / 10;

export function step(m, dtSec = 1) {
  if (m.commLost) return null;
  const eq = equilibrium(m);
  const a = 1 - Math.exp(-dtSec / 2.2);
  const temp = m.temp + (eq.temp - m.temp) * a + noise(eq.temp * 0.003);
  const vib = Math.max(0, m.vib + (eq.vib - m.vib) * a + noise(eq.vib * 0.03));
  const usage = Math.max(0, Math.min(100, m.usage + (eq.usage - m.usage) * a + noise(eq.usage > 0 ? 1.2 : 0)));
  const snap = {
    ...telemetrySnapshot(m),
    temp: Math.round(temp * 10) / 10,
    vib: Math.round(vib * 100) / 100,
    usage: Math.round(usage),
  };
  const running = runningState(m);
  const s = effectiveSpeed(m) / 100;
  if (m.fuel != null) {
    const burn = running ? (0.035 + 0.11 * s) * dtSec : 0.004 * dtSec;
    snap.fuel = round1(Math.max(0, Math.min(100, m.fuel - burn + noise(0.04))));
  }
  if (m.humidity != null) {
    const target = m.params.targetHumidity ?? m.base.humidity ?? m.humidity;
    const eqH = target + (m.params.mode === 'off' ? 6 : 2 - 4 * s);
    const ah = 1 - Math.exp(-dtSec / 3.2);
    snap.humidity = round1(Math.max(20, Math.min(98, m.humidity + (eqH - m.humidity) * ah + noise(0.35))));
  }
  if (m.nh3 != null) {
    const vent = m.params.mode === 'off' ? 0.15 : 0.35 + 0.65 * s;
    const eqN = (m.base.nh3 ?? m.nh3) / Math.max(0.35, vent);
    const an = 1 - Math.exp(-dtSec / 2.8);
    snap.nh3 = round1(Math.max(0, m.nh3 + (eqN - m.nh3) * an + noise(0.12)));
  }
  if (m.activity != null) {
    const eqA = (m.base.activity ?? 40) * (m.params.mode === 'off' ? 0.15 : 0.35 + 0.65 * s);
    const aa = 1 - Math.exp(-dtSec / 2);
    snap.activity = Math.round(Math.max(0, Math.min(100, m.activity + (eqA - m.activity) * aa + noise(1.2))));
  }
  if (m.outside != null) {
    const cap = m.headcount ?? 80;
    const drift = Math.random() < 0.04 * dtSec ? (Math.random() < 0.65 ? -1 : 1) : 0;
    snap.outside = Math.max(0, Math.min(cap, m.outside + drift));
  }
  if (m.base?.speedKmh != null) snap.speedKmh = round1(s * m.base.speedKmh);
  return snap;
}
