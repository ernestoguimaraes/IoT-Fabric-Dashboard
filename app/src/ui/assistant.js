// Pop-up do assistente virtual (agente Foundry ou mock), com contexto ao vivo da planta.
import { $, el, esc, setText } from './dom.js';
import { store } from '../state.js';
import { buildContext } from '../integration/agent/context.js';

const md = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');

export function mountAssistant(agent) {
  const box = $('#assistant');
  const msgs = $('#as-msgs');
  const input = $('#as-input');
  const chips = $('#as-chips');
  let busy = false;

  setText($('#as-sub'), `${agent.label} · ${agent.mode === 'foundry' ? 'online' : 'demo'}`);

  const greet = () => addMsg('bot',
    'Olá! Sou o assistente da Linha A. Posso explicar como cada máquina funciona, por que um ativo está em alerta, quais parâmetros ajustar e a manutenção recomendada.\nSelecione uma máquina na cena ou pergunte direto.');

  function addMsg(kind, text, src) {
    const n = el('div', { class: `msg ${kind}` });
    n.innerHTML = md(text);
    if (src) n.append(el('span', { class: 'src' }, src));
    msgs.append(n);
    msgs.scrollTop = msgs.scrollHeight;
    return n;
  }

  async function ask(text) {
    text = text.trim();
    if (!text || busy) return;
    busy = true;
    $('#as-send').disabled = true;
    input.value = '';
    addMsg('user', text);
    const typing = addMsg('bot typing', 'Analisando telemetria');
    try {
      const res = await agent.send(text, buildContext(store.state));
      typing.remove();
      addMsg('bot', res.text || '(sem resposta)', res.source);
    } catch (e) {
      typing.remove();
      addMsg('bot err', `Não consegui falar com o agente: ${e.message}`);
    } finally {
      busy = false;
      $('#as-send').disabled = false;
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
  $('#as-clear').addEventListener('click', () => { agent.reset(); msgs.replaceChildren(); greet(); });
  $('#as-form').addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input.value); }
  });

  // contexto + sugestões reativos à seleção e ao estado das máquinas
  store.subscribe(['selection', 'machines'], (s) => {
    const m = s.selectedId ? s.byId[s.selectedId] : null;
    $('#as-ctx').innerHTML = m
      ? `Contexto: <b>${esc(m.id)} · ${esc(m.name)}</b> (${m.status === 'online' ? 'online' : m.status === 'alert' ? 'em alerta' : 'offline'})`
      : 'Contexto: <b>planta inteira</b>';
    const firstAlert = s.machines.find((x) => x.status === 'alert');
    const sugg = m
      ? [m.status !== 'online' ? `Por que a ${m.id} está ${m.status === 'alert' ? 'em alerta' : 'offline'}?` : `Como funciona a ${m.id}?`,
        `Quais parâmetros ajustar na ${m.id}?`, `Manutenção preventiva da ${m.id}`, 'Resumo da planta']
      : [firstAlert ? `Por que a ${firstAlert.id} está em alerta?` : 'Como funciona a INJ-002?', 'Resumo da planta', 'Quais comandos posso enviar?'];
    const key = sugg.join('|');
    if (chips.dataset.key === key) return;
    chips.dataset.key = key;
    chips.replaceChildren(...sugg.map((t) => el('button', { type: 'button', onclick: () => ask(t) }, t)));
  });

  return { open, close, ask };
}
