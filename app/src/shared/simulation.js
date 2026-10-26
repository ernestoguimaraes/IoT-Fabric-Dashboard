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

export function telemetrySnapshot(m) {
  if (m.commLost) return null;
  return {
    machineId: m.id,
    ts: new Date().toISOString(),
    temp: m.temp,
    vib: m.vib,
    usage: m.usage,
    mode: m.params.mode,
    speed: m.params.speed,
    isRunning: runningState(m),
  };
}

export function equilibrium(m) {
  const s = effectiveSpeed(m) / 100;
  const { targetTemp, cycleTime, mode } = m.params;
  const c = Math.sqrt((m.defaults?.cycleTime || cycleTime) / cycleTime);
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

export function step(m, dtSec = 1) {
  if (m.commLost) return null;
  const eq = equilibrium(m);
  const a = 1 - Math.exp(-dtSec / 2.2);
  const temp = m.temp + (eq.temp - m.temp) * a + noise(eq.temp * 0.003);
  const vib = Math.max(0, m.vib + (eq.vib - m.vib) * a + noise(eq.vib * 0.03));
  const usage = Math.max(0, Math.min(100, m.usage + (eq.usage - m.usage) * a + noise(eq.usage > 0 ? 1.2 : 0)));
  return {
    ...telemetrySnapshot(m),
    temp: Math.round(temp * 10) / 10,
    vib: Math.round(vib * 100) / 100,
    usage: Math.round(usage),
  };
}
