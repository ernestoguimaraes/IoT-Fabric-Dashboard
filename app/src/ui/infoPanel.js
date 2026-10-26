// Painel da máquina selecionada (métricas ao vivo, setpoints, comandos).
import { $, el, setText, fmt, hms, toast } from './dom.js';
import { store, selectMachine, openEditor, sendCommand } from '../state.js';
import { MODES, TYPE_LABEL } from '../shared/machines.js';
import { STATUS_LABEL } from '../shared/rules.js';

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
    if (cmd === 'EMERGENCY_STOP' && !confirm(`Confirmar EMERGENCY_STOP em ${m.id} — ${m.name}?`)) return;
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
    setText($('#panel-type'), TYPE_LABEL[m.type]);
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
    const tOver = !off && m.temp >= p.tempLimit;
    const vOver = !off && m.vib >= p.vibLimit;
    setText($('#panel-temp'), off ? '—' : `${fmt(m.temp)} °C`);
    setText($('#panel-vib'), off ? '—' : `${fmt(m.vib, 1)} mm/s`);
    setText($('#panel-usage'), off ? '—' : `${fmt(m.usage)} %`);
    $('#panel-temp').classList.toggle('over', tOver);
    $('#panel-vib').classList.toggle('over', vOver);
    bar('#bar-temp', off ? 0 : m.temp / p.tempLimit, tOver);
    bar('#bar-vib', off ? 0 : m.vib / p.vibLimit, vOver);
    bar('#bar-usage', off ? 0 : m.usage / 100, false);

    const sum = $('#panel-params');
    const items = [
      ['Operação (telemetria)', m.isRunning ? 'Em funcionamento' : 'Parado'],
      ['Modo', MODES[p.mode]], ['Velocidade', `${p.speed} %`], ['Temp. alvo', `${fmt(p.targetTemp)} °C`],
      ['Lim. temp.', `${fmt(p.tempLimit)} °C`], ['Lim. vibr.', `${fmt(p.vibLimit, 1)} mm/s`], ['Ciclo', `${p.cycleTime} s`],
    ];
    if (sum.children.length !== items.length) sum.replaceChildren(...items.map(([k]) => el('div', {}, `${k}: `, el('b'))));
    items.forEach(([, v], i) => setText(sum.children[i].querySelector('b'), v));

    setText($('#panel-hint'), off
      ? `Sem leitura desde ${hms(new Date(m.lastSeen))} · comando executado como m.silveira (envie RESUME para reconectar).`
      : `Leitura ${hms(new Date(m.lastSeen))} via ${s.connection.mode === 'fabric' ? 'Fabric RTI' : 'simulador'} · comandos executados como m.silveira e registrados no log.`);
  });
}
