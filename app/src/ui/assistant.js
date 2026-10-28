// Foundry: conversa direta. Mock: assistente local com contexto da planta.
import { $, el, esc, setText } from './dom.js';
import { store } from '../state.js';
import { buildContext } from '../integration/agent/context.js';
import { activeScenario } from '../scenarios/index.js';

const md = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');

export function mountAssistant(agent) {
  const box = $('#assistant');
  const msgs = $('#as-msgs');
  const input = $('#as-input');
  const chips = $('#as-chips');
  let agentRef = agent;
  let busy = false;

  function applyAgent(next) {
    agentRef = next;
    const mock = next.mode === 'mock';
    setText($('#as-sub'), mock ? `${next.label} · demo` : next.label);
    input.placeholder = next.placeholder || (mock
      ? activeScenario().chrome.askPlaceholder
      : 'Envie uma mensagem ao agente Foundry…');
  }
  applyAgent(agent);

  const greet = () => {
    if (agentRef.mode !== 'mock') return;
    addMsg('bot', agentRef.intro || 'Olá! Sou o assistente da Linha A. Posso explicar como cada máquina funciona, por que um ativo está em alerta, quais parâmetros ajustar e a manutenção recomendada.\nSelecione uma máquina na cena ou pergunte direto.');
  };

  function addMsg(kind, text, src) {
    const n = el('div', { class: `msg ${kind}` });
    n.innerHTML = md(text);
    if (src) n.append(el('span', { class: 'src' }, src));
    msgs.append(n);
    msgs.scrollTop = msgs.scrollHeight;
    return n;
  }

  async function ask(text) {
    if (!text.trim() || busy) return;
    if (agentRef.mode === 'mock') text = text.trim();
    busy = true;
    $('#as-send').disabled = true;
    $('#as-clear').disabled = true;
    input.value = '';
    addMsg('user', text);
    const typing = addMsg('bot typing', agentRef.mode === 'mock' ? 'Analisando telemetria' : 'Aguardando Foundry…');
    try {
      const res = await agentRef.send(text, buildContext(store.state));
      typing.remove();
      addMsg('bot', res.text, res.source);
    } catch (e) {
      typing.remove();
      addMsg('bot err', `Não consegui falar com o agente: ${e.message}`);
    } finally {
      busy = false;
      $('#as-send').disabled = false;
      $('#as-clear').disabled = false;
      input.focus();
    }
  }

  function open(prefill) {
    box.classList.add('open');
    $('#assistant-fab').style.display = 'none';
    if (!msgs.children.length) greet();
    if (prefill) ask(prefill); else input.focus();
  }
  function close() {
    box.classList.remove('open');
    $('#assistant-fab').style.display = '';
  }

  $('#assistant-fab').addEventListener('click', () => open());
  $('#as-close').addEventListener('click', close);
  $('#as-clear').addEventListener('click', () => { agentRef.reset(); msgs.replaceChildren(); greet(); });
  $('#as-form').addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input.value); }
  });

  // contexto + sugestões reativos à seleção e ao estado das máquinas
  store.subscribe(['selection', 'machines'], (s) => {
    const m = s.selectedId ? s.byId[s.selectedId] : null;
    $('#as-ctx').innerHTML = m
      ? `Contexto: <b>${esc(m.id)} · ${esc(m.name)}</b> (${m.status === 'online' ? 'online' : m.status === 'alert' ? 'em alerta' : 'offline'})`
      : `Contexto: <b>${esc(activeScenario().chrome.contextAll)}</b>`;
    const chrome = activeScenario().chrome;
    const firstAlert = s.machines.find((x) => x.status === 'alert');
    const sample = s.machines[1]?.id || s.machines[0]?.id || 'INJ-002';
    const sugg = m
      ? [m.status !== 'online' ? `Por que a ${m.id} está ${m.status === 'alert' ? 'em alerta' : 'offline'}?` : `Como funciona a ${m.id}?`,
        `Quais parâmetros ajustar na ${m.id}?`, `Manutenção preventiva da ${m.id}`, chrome.summaryChip]
      : [firstAlert ? `Por que a ${firstAlert.id} está em alerta?` : `Como funciona a ${sample}?`, chrome.summaryChip, 'Quais comandos posso enviar?'];
    const key = sugg.join('|');
    if (chips.dataset.key === key) return;
    chips.dataset.key = key;
    chips.replaceChildren(...sugg.map((t) => el('button', { type: 'button', onclick: () => ask(t) }, t)));
  });

  function bind(next) {
    applyAgent(next);
    msgs.replaceChildren();
    chips.dataset.key = '';
    if (box.classList.contains('open')) greet();
  }

  return { open, close, ask, bind };
}
