// Painel da máquina selecionada (métricas ao vivo, setpoints, comandos).
import { $, el, setText, fmt, hms, toast } from './dom.js';
import { store, selectMachine, openEditor, sendCommand } from '../state.js';
import { MODES, TYPE_LABEL } from '../shared/machines.js';
import { STATUS_LABEL } from '../shared/rules.js';
import { activeScenario } from '../scenarios/index.js';
import { metricsOf, metricOver, metricRatio } from '../scenarios/metrics.js';

export function mountInfoPanel({ onAsk, agentMode }) {
  const panel = $('#info-panel');
  const prevStatus = {};

  $('#panel-close').addEventListener('click', () => selectMachine(null));
  $('#btn-params').addEventListener('click', () => store.state.selectedId && openEditor(store.state.selectedId));
  $('#btn-ask').addEventListener('click', () => {
    const m = store.state.byId[store.state.selectedId];
    if (!m) return;
    onAsk(m.status === 'online' ? `Como funciona a ${m.id}?` : `Por que a ${m.id} está em ${STATUS_LABEL[m.status].toLowerCase()}?`);
  });

  $('#cmd-send').addEventListener('click', async () => {
    const sel = $('#cmd-select');
    const cmd = sel.value;
    const m = store.state.byId[store.state.selectedId];
    if (!cmd || !m) return;
    const spec = activeScenario().commandsFor(m).find((c) => c.id === cmd);
    if (spec?.confirm && !confirm(`Confirmar ${spec.label} em ${m.id} — ${m.name}?`)) return;
    sel.value = '';
    try {
      await sendCommand(m.id, cmd);
      toast(`✅ Comando "${cmd}" enviado para ${m.id} — ${m.name}`);
    } catch (e) {
      toast(`⚠️ Falha ao enviar ${cmd}: ${e.message}`, 'err');
    }
  });

  function bar(id, ratio, over) {
    const i = $(id);
    i.style.width = `${Math.max(2, Math.min(100, ratio * 100))}%`;
    i.style.background = over ? 'var(--red)' : ratio > 0.9 ? 'var(--yellow)' : '#2dd4bf';
  }

  store.subscribe(['selection', 'machines'], (s) => {
    const m = s.selectedId ? s.byId[s.selectedId] : null;
    if (!m) { panel.classList.remove('visible'); return; }
    panel.classList.add('visible');
    setText($('#panel-name'), `${m.id} — ${m.name}`);
    setText($('#panel-type'), m.typeLabel || TYPE_LABEL[m.type] || m.type);
    const sel = $('#cmd-select');
    const cmds = activeScenario().commandsFor(m);
    if (sel.dataset.family !== `${store.state.scenario}:${m.family || 'factory'}`) {
      sel.dataset.family = `${store.state.scenario}:${m.family || 'factory'}`;
      sel.replaceChildren(
        el('option', { value: '' }, '— Enviar comando —'),
        ...cmds.map((c) => el('option', { value: c.id }, c.label)),
      );
    }
    const badge = $('#panel-status');
    setText(badge, STATUS_LABEL[m.status]);
    badge.className = 'status-badge ' + m.status;
    if (prevStatus[m.id] && prevStatus[m.id] !== m.status) {
      panel.querySelectorAll('.metric').forEach((x) => { x.classList.remove('flash'); void x.offsetWidth; x.classList.add('flash'); });
    }
    prevStatus[m.id] = m.status;

    const reasons = $('#panel-reasons');
    reasons.replaceChildren(...m.reasons.map((r) => el('div', { class: r.level }, '⚠ ', r.text)));

    const p = m.params;
    const off = m.commLost;
    const metrics = metricsOf(m);
    const slots = panel.querySelectorAll('.metric');
    metrics.forEach((metric, i) => {
      const slot = slots[i];
      if (!slot) return;
      const over = !off && metricOver(m, metric);
      const value = m[metric.key];
      slot.querySelector('.m-label').textContent = metric.label;
      const shown = off || !Number.isFinite(value) ? '—' : `${fmt(value, metric.digits || 0)} ${metric.unit}`;
      const val = slot.querySelector('.m-value');
      setText(val, shown);
      val.classList.toggle('over', over);
      bar(`#${slot.querySelector('.bar i').id}`, off ? 0 : metricRatio(m, metric), over);
    });

    const schema = activeScenario().paramSchema(m.type);
    const sum = $('#panel-params');
    const items = [
      ['Operação (telemetria)', m.isRunning ? 'Em funcionamento' : 'Parado'],
      ...(m.location ? [['Localização', m.location]] : []),
      ...Object.keys(schema).map((k) => {
        const spec = schema[k];
        const v = p[k];
        const shown = k === 'mode' ? (MODES[v] || v) : `${fmt(v, String(spec.step || 1).includes('.') ? 1 : 0)} ${spec.unit || ''}`.trim();
        return [spec.label, shown];
      }),
    ];
    if (sum.children.length !== items.length) sum.replaceChildren(...items.map(([k]) => el('div', {}, `${k}: `, el('b'))));
    items.forEach(([k, v], i) => {
      sum.children[i].firstChild.textContent = `${k}: `;
      setText(sum.children[i].querySelector('b'), v);
    });

    const who = s.operator?.login || 'm.silveira';
    const via = s.scenario === 'farm' ? 'simulador da fazenda' : s.connection.mode === 'fabric' ? 'Fabric RTI' : 'simulador';
    setText($('#panel-hint'), off
      ? `Sem leitura desde ${hms(new Date(m.lastSeen))} · comando executado como ${who} (envie RESUME para reconectar).`
      : `Leitura ${hms(new Date(m.lastSeen))} via ${via} · comandos executados como ${who} e registrados no log.`);
  });
}
