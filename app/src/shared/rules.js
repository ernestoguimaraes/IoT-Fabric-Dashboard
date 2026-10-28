// Regras de status: derivam online / alerta / offline a partir da telemetria x setpoints.

const hhmm = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmt = (n, d = 0) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

export function evaluate(m) {
  const reasons = [];
  if (m.commLost) {
    reasons.push({ level: 'offline', text: `Sem comunicação desde ${hhmm(m.lastSeen)} — verificar gateway/sensor.` });
    return { status: 'offline', reasons };
  }
  if (m.params.mode === 'off') {
    reasons.push({ level: 'offline', text: 'Desligada pelo operador (modo Desligado).' });
    return { status: 'offline', reasons };
  }
  const { tempLimit, vibLimit } = m.params;
  if (m.temp >= tempLimit) {
    const critical = m.temp >= tempLimit * 1.05;
    reasons.push({
      level: critical ? 'critical' : 'warn',
      text: `Temperatura ${critical ? 'crítica' : 'elevada'} ${fmt(m.temp)} °C — acima do limite de ${fmt(tempLimit)} °C.`,
    });
  }
  if (m.vib >= vibLimit) {
    reasons.push({ level: 'warn', text: `Vibração elevada ${fmt(m.vib, 1)} mm/s — limite ${fmt(vibLimit, 1)} mm/s.` });
  }
  if (Number.isFinite(m.fuel) && Number.isFinite(m.params.fuelMin) && m.fuel <= m.params.fuelMin) {
    const critical = m.fuel <= m.params.fuelMin * 0.6;
    reasons.push({
      level: critical ? 'critical' : 'warn',
      text: `Combustível ${critical ? 'crítico' : 'baixo'} ${fmt(m.fuel)} % — mínimo operacional ${fmt(m.params.fuelMin)} %.`,
    });
  }
  if (Number.isFinite(m.humidity) && Number.isFinite(m.params.humidityLimit) && m.humidity >= m.params.humidityLimit) {
    reasons.push({ level: 'warn', text: `Umidade elevada ${fmt(m.humidity)} % — limite ${fmt(m.params.humidityLimit)} %.` });
  }
  if (Number.isFinite(m.nh3) && Number.isFinite(m.params.nh3Limit) && m.nh3 >= m.params.nh3Limit) {
    const critical = m.nh3 >= m.params.nh3Limit * 1.15;
    reasons.push({
      level: critical ? 'critical' : 'warn',
      text: `Amônia ${critical ? 'crítica' : 'elevada'} ${fmt(m.nh3)} ppm — limite ${fmt(m.params.nh3Limit)} ppm.`,
    });
  }
  if (Number.isFinite(m.activity) && Number.isFinite(m.params.activityLimit) && m.activity >= m.params.activityLimit) {
    reasons.push({ level: 'warn', text: `Atividade elevada ${fmt(m.activity)} % — limite ${fmt(m.params.activityLimit)} %.` });
  }
  if (Number.isFinite(m.outside) && Number.isFinite(m.params.outsideLimit) && m.outside > m.params.outsideLimit) {
    reasons.push({ level: 'warn', text: `${fmt(m.outside)} animal(is) fora da cerca — limite ${fmt(m.params.outsideLimit)}.` });
  }
  if (m.params.mode === 'paused') reasons.push({ level: 'warn', text: 'Operação pausada pelo operador.' });
  return { status: reasons.length ? 'alert' : 'online', reasons };
}

export const STATUS_LABEL = { online: 'Online', alert: 'Alerta', offline: 'Offline' };
