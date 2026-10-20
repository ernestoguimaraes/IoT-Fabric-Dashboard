// Contexto enviado ao agente: snapshot da máquina selecionada + resumo da planta.
import { TYPE_LABEL, MODES } from '../../shared/machines.js';
import { STATUS_LABEL } from '../../shared/rules.js';

export function machineSnapshot(m) {
  return {
    id: m.id, name: m.name, type: m.type, typeLabel: TYPE_LABEL[m.type],
    status: m.status, statusLabel: STATUS_LABEL[m.status],
    telemetry: { temp: Math.round(m.temp * 10) / 10, vib: m.vib, usage: Math.round(m.usage) },
    params: { ...m.params, modeLabel: MODES[m.params.mode] },
    defaults: { ...m.defaults },
    commLost: m.commLost,
    reasons: m.reasons.map((r) => r.text),
  };
}

export function buildContext(state) {
  const sel = state.selectedId ? state.byId[state.selectedId] : null;
  const count = (s) => state.machines.filter((m) => m.status === s).length;
  return {
    plant: 'Unidade Industrial Guarulhos · Linha A · Turno 2',
    summary: { online: count('online'), alert: count('alert'), offline: count('offline'), total: state.machines.length },
    alerts: state.machines.filter((m) => m.status !== 'online')
      .map((m) => ({ id: m.id, name: m.name, status: m.status, reasons: m.reasons.map((r) => r.text) })),
    selected: sel ? machineSnapshot(sel) : null,
    machines: state.machines.map((m) => ({ id: m.id, name: m.name, type: m.type, status: m.status })),
  };
}
