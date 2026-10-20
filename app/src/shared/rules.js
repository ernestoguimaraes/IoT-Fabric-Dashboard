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
  if (m.params.mode === 'paused') reasons.push({ level: 'warn', text: 'Operação pausada pelo operador.' });
  return { status: reasons.length ? 'alert' : 'online', reasons };
}

export const STATUS_LABEL = { online: 'Online', alert: 'Alerta', offline: 'Offline' };
