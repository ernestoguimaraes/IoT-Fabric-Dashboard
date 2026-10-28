// Janela de ajuste de parâmetros: pré-visualização ao vivo (reativa), validação, aplicar/cancelar.
import { $, el, setText, fmt, toast } from './dom.js';
import { store, closeEditor, previewParams, commitParams } from '../state.js';
import { MODES, TYPE_LABEL } from '../shared/machines.js';
import { STATUS_LABEL } from '../shared/rules.js';
import { activeScenario } from '../scenarios/index.js';
import { metricsOf, metricOver } from '../scenarios/metrics.js';

export function mountParamsModal() {
  const modal = $('#params-modal');
  const form = $('#pm-form');
  let current = null; // { id, snapshot, draft, schema }

  const decimals = (s) => (String(s.step).split('.')[1] || '').length;
  const show = (k, v, s) => (k === 'mode' ? MODES[v] : `${fmt(v, decimals(s))} ${s.unit}`);
  const keys = () => Object.keys(current.schema);

  function validate() {
    const { draft, schema } = current;
    let ok = true;
    for (const k of keys()) {
      if (k === 'mode') continue;
      const s = schema[k];
      const f = form.querySelector(`[data-k="${k}"]`);
      let msg = '';
      const v = draft[k];
      if (!Number.isFinite(v)) msg = 'Valor inválido.';
      else if (v < s.min || v > s.max) msg = `Fora da faixa permitida (${s.min}–${s.max} ${s.unit}).`;
      else if (k === 'tempLimit' && schema.targetTemp && Number.isFinite(draft.targetTemp) && v <= draft.targetTemp) msg = 'O limite de alarme deve ser maior que a temperatura alvo.';
      f.classList.toggle('invalid', !!msg);
      setText(f.querySelector('.err'), msg);
      if (msg) ok = false;
    }
    $('#pm-apply').disabled = !ok;
    return ok;
  }

  function markChanged() {
    const { draft, snapshot, schema } = current;
    let n = 0;
    for (const k of keys()) {
      const f = form.querySelector(`[data-k="${k}"]`);
      const changed = draft[k] !== snapshot[k];
      if (changed) n++;
      const val = f.querySelector('.val');
      val.classList.toggle('changed', changed);
      setText(val, show(k, draft[k], schema[k]));
      if (k === 'mode') f.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === draft.mode));
    }
    setText($('#pm-apply'), n ? `Aplicar (${n})` : 'Aplicar');
  }

  function onChange(k, v, from) {
    current.draft[k] = v;
    const f = form.querySelector(`[data-k="${k}"]`);
    if (k !== 'mode') {
      if (from !== 'range') f.querySelector('input[type=range]').value = v;
      if (from !== 'number') f.querySelector('input[type=number]').value = v;
    }
    markChanged();
    if (validate()) previewParams(current.id, { [k]: v }); // reflete na cena, painel, alertas e KPIs
  }

  function build(m) {
    const schema = activeScenario().paramSchema(m.type);
    current = { id: m.id, snapshot: { ...m.params }, draft: { ...m.params }, schema };
    setText($('#pm-title'), `⚙️ Parâmetros — ${m.id}`);
    setText($('#pm-sub'), `${m.name} · ${m.typeLabel || TYPE_LABEL[m.type] || m.type}`);
    form.replaceChildren(...Object.keys(schema).map((k) => {
      const s = schema[k];
      const head = el('div', { class: 'row' }, el('label', { for: `pm-${k}` }, s.label), el('span', { class: 'val' }));
      if (k === 'mode') {
        return el('div', { class: 'field', dataset: { k } }, head,
          el('div', { class: 'mode-group', role: 'radiogroup' }, Object.entries(MODES).map(([v, label]) =>
            el('button', { type: 'button', dataset: { v }, role: 'radio', onclick: () => onChange('mode', v) }, label))));
      }
      const range = el('input', { type: 'range', min: s.min, max: s.max, step: s.step, value: m.params[k], 'aria-label': s.label,
        oninput: (e) => onChange(k, +e.target.value, 'range') });
      const num = el('input', { id: `pm-${k}`, type: 'number', min: s.min, max: s.max, step: s.step, value: m.params[k],
        oninput: (e) => onChange(k, e.target.value === '' ? NaN : +e.target.value, 'number') });
      return el('div', { class: 'field', dataset: { k } }, head,
        el('div', { class: 'ctl' }, range, num),
        el('div', { class: 'hint' }, `Faixa ${s.min}–${s.max} ${s.unit} · padrão ${m.defaults[k]} ${s.unit}`),
        el('div', { class: 'err' }));
    }));
    markChanged();
    validate();
  }

  function renderLive() {
    if (!current) return;
    const m = store.state.byId[current.id];
    const live = $('#pm-live');
    const cells = [
      ['Status', STATUS_LABEL[m.status], `var(--${m.status === 'online' ? 'green' : m.status === 'alert' ? 'yellow' : 'red'})`],
      ...metricsOf(m).map((metric) => {
        const value = m[metric.key];
        const shown = m.commLost || !Number.isFinite(value) ? '—' : `${fmt(value, metric.digits ?? 1)} ${metric.unit}`;
        return [metric.label, shown, metricOver(m, metric) ? 'var(--red)' : ''];
      }),
    ];
    if (live.children.length !== cells.length) {
      live.replaceChildren(...cells.map(() => el('div', {}, el('div', { class: 'lv-label' }), el('div', { class: 'lv-value' }))));
    }
    cells.forEach(([k, v, c], i) => {
      setText(live.children[i].querySelector('.lv-label'), k);
      const val = live.children[i].querySelector('.lv-value');
      setText(val, v); val.style.color = c;
    });
    const dirty = keys().some((k) => current.draft[k] !== current.snapshot[k]);
    const profile = activeScenario();
    const note = $('#pm-note');
    note.innerHTML = dirty ? profile.previewNote : profile.publishNote;
  }

  function open(id) {
    const m = store.state.byId[id];
    if (!m) return;
    build(m);
    $('#pm-live').replaceChildren();
    renderLive();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => form.querySelector('button.on, input')?.focus(), 30);
  }

  function hide() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    current = null;
  }

  function cancel() {
    if (current) previewParams(current.id, current.snapshot); // desfaz pré-visualização
    closeEditor();
  }

  async function apply() {
    if (!current || !validate()) return;
    const { id, draft, snapshot } = current;
    const changed = keys().filter((k) => draft[k] !== snapshot[k]);
    closeEditor();
    if (!changed.length) { toast('Nenhuma alteração para aplicar.', 'info'); return; }
    try {
      await commitParams(id, { ...draft }, { prev: snapshot });
      const where = store.state.scenario === 'farm' ? 'simulador da fazenda' : store.state.connection.mode === 'fabric' ? 'Fabric Eventstream' : 'simulador';
      toast(`✅ ${changed.length} parâmetro(s) de ${id} publicados no ${where}`);
    } catch (e) {
      toast(`⚠️ Parâmetros aplicados localmente, mas a sincronização falhou: ${e.message}`, 'err');
    }
  }

  $('#pm-close').addEventListener('click', cancel);
  $('#pm-cancel').addEventListener('click', cancel);
  $('#pm-apply').addEventListener('click', apply);
  $('#pm-reset').addEventListener('click', () => {
    const m = store.state.byId[current?.id];
    if (!m) return;
    for (const k of keys()) if (current.draft[k] !== m.defaults[k]) onChange(k, m.defaults[k]);
  });
  modal.addEventListener('click', (e) => { if (e.target === modal) cancel(); });
  document.addEventListener('keydown', (e) => {
    if (!current) return;
    if (e.key === 'Escape') cancel();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) apply();
  });

  store.subscribe(['selection'], (s) => {
    if (s.editingId && s.editingId !== current?.id) open(s.editingId);
    else if (!s.editingId && current) hide();
  });
  store.subscribe(['machines'], renderLive, { immediate: false });
}
