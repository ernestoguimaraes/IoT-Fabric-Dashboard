// Store reativo mínimo (pub/sub com tópicos e notificação em lote por microtask).
//   store.state            → estado atual (objetos mutáveis, lidos diretamente pela cena 3D)
//   store.update(topics, fn) → aplica mutação e notifica os tópicos alterados
//   store.subscribe(topics, cb) → cb(state, changedTopics) quando algum tópico casar
// Tópicos: 'machines', 'machine:<ID>', 'selection', 'connection', 'log', 'kpis', 'agent'

export function createStore(initial) {
  const state = initial;
  const listeners = new Set();
  let pending = new Set();
  let scheduled = false;

  function flush() {
    scheduled = false;
    const changed = pending;
    pending = new Set();
    for (const l of listeners) {
      if (l.topics === '*' || l.topics.some((t) => changed.has(t) || (t.endsWith('*') && [...changed].some((c) => c.startsWith(t.slice(0, -1)))))) {
        try { l.cb(state, changed); } catch (e) { console.error('[store] listener error', e); }
      }
    }
  }

  return {
    state,
    update(topics, fn) {
      if (fn) fn(state);
      (Array.isArray(topics) ? topics : [topics]).forEach((t) => pending.add(t));
      if (!scheduled) { scheduled = true; queueMicrotask(flush); }
    },
    subscribe(topics, cb, { immediate = true } = {}) {
      const l = { topics: topics === '*' ? '*' : [].concat(topics), cb };
      listeners.add(l);
      if (immediate) cb(state, new Set());
      return () => listeners.delete(l);
    },
  };
}
