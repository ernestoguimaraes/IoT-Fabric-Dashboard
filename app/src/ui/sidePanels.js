// HUD, lista de ativos, alertas, KPIs, sincronização Fabric, log e barra de status — todos reativos.
import { $, el, setText, reconcile, fmt, hms } from './dom.js';
import { store, selectMachine } from '../state.js';
import { activeScenario } from '../scenarios/index.js';

export function hydrateChrome(profile) {
  const c = profile.chrome;
  document.title = profile.documentTitle;
  $('#app').dataset.scenario = profile.id;
  $('#wordmark').innerHTML = c.wordmark;
  setText($('#page-title'), c.title);
  setText($('#page-sub'), c.subtitle);
  setText($('#op-avatar'), profile.operator.avatar);
  setText($('#op-name'), profile.operator.name);
  setText($('#op-meta'), profile.operator.meta);
  $('#hud-title').innerHTML = c.hud;
  setText($('#assets-title'), c.assetsTitle);
  setText($('#howto-title'), c.howtoTitle);
  $('#howto-list').innerHTML = c.howto.map((step) => `<li>${step}</li>`).join('');
  setText($('#proc-title'), c.procTitle);
  $('#proc-list').innerHTML = c.proc.map((step) => `<li>${step}</li>`).join('');
  $('#proc-callout').innerHTML = c.callout;
  setText($('#contacts-title'), c.contactsTitle);
  $('#contacts-list').replaceChildren(...c.contacts.map(([k, v]) =>
    el('div', { class: 'kv' }, el('span', { class: 'k' }, k), el('span', { class: 'v' }, v))));
  const [user, role, login, perm] = c.session;
  setText($('#session-user'), user[1]);
  setText($('#session-role'), role[1]);
  setText($('#session-login'), login[1]);
  setText($('#session-perm'), perm[1]);
  setText($('#kpi-title'), c.kpiTitle);
  setText($('#sync-title'), c.syncTitle);
  setText($('#footer-brand'), c.footer);
  const sel = $('#scenario-select');
  if (sel) sel.value = profile.id;
}

export function mountSidePanels({ source }) {
  const runtime = { source };
  // ─── HUD ───
  store.subscribe(['machines'], (s) => {
    const c = (st) => s.machines.filter((m) => m.status === st).length;
    setText($('#stat-online'), c('online'));
    setText($('#stat-alert'), c('alert'));
    setText($('#stat-offline'), c('offline'));
  });

  // ─── Lista de ativos ───
  const list = $('#machine-list');
  store.subscribe(['machines', 'selection'], (s) => {
    reconcile(list, s.machines, (m) => m.id,
      (m) => el('button', { class: 'machine-chip', type: 'button', title: m.name, onclick: () => selectMachine(m.id) },
        el('span', { class: 'd' }), el('span', {}, m.id)),
      (node, m) => {
        node.querySelector('.d').className = `d ${m.status}`;
        node.classList.toggle('active', s.selectedId === m.id);
      });
  });

  // ─── Alertas ativos (derivados das regras) ───
  const alerts = $('#alerts');
  store.subscribe(['machines'], (s) => {
    const rank = { critical: 0, warn: 1, offline: 2 };
    const items = s.machines.filter((m) => m.status !== 'online').map((m) => {
      const level = m.status === 'offline' ? 'offline' : m.reasons.some((r) => r.level === 'critical') ? 'critical' : 'warn';
      return { m, level };
    }).sort((a, b) => rank[a.level] - rank[b.level]);
    setText($('#alert-count'), items.length ? `(${items.length})` : '');
    if (!items.length) {
      alerts.innerHTML = '<div class="alert-empty">✅ Nenhum alerta ativo — todos os ativos dentro dos limites.</div>';
      return;
    }
    alerts.querySelector('.alert-empty')?.remove();
    reconcile(alerts, items, (x) => x.m.id,
      (x) => el('div', { class: 'alert-item', role: 'button', tabindex: '0',
        onclick: () => selectMachine(x.m.id), onkeydown: (e) => e.key === 'Enter' && selectMachine(x.m.id) },
        el('div', { class: 'ai-body' }, el('div', { class: 'ai-title' }), el('div', { class: 'ai-desc' }))),
      (node, x) => {
        node.className = `alert-item ${x.level === 'warn' ? '' : x.level}`;
        setText(node.querySelector('.ai-title'), `${x.m.id} · ${x.m.name}`);
        setText(node.querySelector('.ai-desc'), x.m.reasons.map((r) => r.text).join(' '));
      });
  });

  // ─── KPIs do turno ───
  const kpis = $('#kpis');
  const kv = (k, id) => el('div', { class: 'kv' }, el('span', { class: 'k' }, k), el('span', { class: 'v', id }));
  store.subscribe(['machines', 'kpis', 'scenario'], (s) => {
    const rows = activeScenario().kpiRows(s);
    if (kpis.children.length !== rows.length) {
      kpis.replaceChildren(...rows.map(() => el('div', { class: 'kv' }, el('span', { class: 'k' }), el('span', { class: 'v' }))));
    }
    rows.forEach((row, i) => {
      setText(kpis.children[i].querySelector('.k'), row.label);
      const value = kpis.children[i].querySelector('.v');
      setText(value, row.value);
      value.style.color = row.color || '';
    });
  });

  // ─── Sincronização Fabric RTI ───
  const sync = $('#sync-info');
  sync.append(kv('Fonte', 's-src'), kv('Estado', 's-state'), kv('Telemetria recebida', 's-in'),
    kv('Eventos publicados', 's-out'), kv('Dispositivos sincronizados', 's-dev'), kv('Última sincronização', 's-last'));
  const STATE = { connecting: ['Conectando…', 'var(--yellow)'], connected: ['Conectado', 'var(--green)'], error: ['Erro', 'var(--red)'] };
  store.subscribe(['connection', 'machines'], (s) => {
    const c = s.connection;
    setText($('#s-src'), c.mode === 'fabric' ? 'Fabric Eventhouse' : activeScenario().chrome.syncSource);
    const [label, color] = STATE[c.status] || ['—', ''];
    const st = $('#s-state'); setText(st, label); st.style.color = color;
    setText($('#s-in'), fmt(c.eventsIn));
    setText($('#s-out'), fmt(c.eventsOut));
    const synced = s.machines.filter((m) => !m.commLost).length;
    setText($('#s-dev'), `${synced}/${s.machines.length}`);
    setText($('#s-last'), hms(c.lastSync));

    // barra de status
    const dot = $('#conn-dot');
    dot.className = 'dot' + (c.status === 'connected' ? '' : c.status === 'error' ? ' err' : ' warn');
    setText($('#conn-text'), `${runtime.source.mode === 'fabric' ? 'Fabric RTI' : 'Simulador'}: ${label.toLowerCase()}`);
    $('#conn-text').title = c.detail || '';
    setText($('#gw-text'), `${activeScenario().chrome.gateway}: ${synced}/${s.machines.length} ativos`);
    setText($('#lat-text'), c.latencyMs != null ? `${c.latencyMs} ms` : '—');
    $('#lat-dot').className = 'dot' + (c.latencyMs == null ? ' idle' : c.latencyMs > 150 ? ' warn' : '');
    setText($('#last-update'), hms(c.lastSync));
  });

  // ─── Log de eventos ───
  const log = $('#event-log');
  store.subscribe(['log'], (s) => {
    const items = s.log.slice(0, 10);
    if (!items.length) { log.innerHTML = '<div class="log-item">Sem eventos ainda.</div>'; return; }
    log.replaceChildren(...items.map((e) => el('div', { class: `log-item ${e.kind}` }, el('time', {}, hms(e.ts)), e.text)));
  });

  return { setSource(next) { runtime.source = next; } };
}
