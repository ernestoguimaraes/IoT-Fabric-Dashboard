import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fmt, hms } from '../app/src/ui/dom.js';

const nodes = new Map();
const node = () => ({
  children: [], style: {},
  append(...children) { this.children.push(...children); },
});
const $ = (selector) => {
  if (!nodes.has(selector)) nodes.set(selector, node());
  return nodes.get(selector);
};
let renderConnection;
const state = {
  machines: [],
  connection: {
    mode: 'mock', status: 'connecting', eventsIn: 1234, eventsOut: 56,
    lastSync: null, latencyMs: null,
  },
};

mock.module('../app/src/ui/dom.js', {
  exports: {
    $, fmt, hms,
    el(_tag, attrs = {}, ...children) {
      const element = node();
      element.append(...children);
      if (attrs.id) nodes.set(`#${attrs.id}`, element);
      return element;
    },
    setText(element, text) { element.textContent = String(text); },
    reconcile() {},
  },
});
mock.module('../app/src/state.js', {
  exports: {
    store: {
      subscribe(topics, callback) {
        if (topics.includes('connection')) {
          renderConnection = callback;
          callback(state);
        }
      },
    },
    selectMachine() {},
  },
});

const { mountSidePanels } = await import('../app/src/ui/sidePanels.js');

test('side panels format synchronization counters on mount and subsequent updates', () => {
  const panels = mountSidePanels({ source: { mode: 'mock' } });
  assert.equal($('#s-in').textContent, fmt(1234));
  assert.equal($('#s-out').textContent, fmt(56));
  assert.equal($('#s-state').textContent, 'Conectando…');

  panels.setSource({ mode: 'fabric' });
  state.connection = {
    ...state.connection, mode: 'fabric', status: 'connected',
    eventsIn: 2345, eventsOut: 67,
  };
  renderConnection(state);
  assert.equal($('#s-in').textContent, fmt(2345));
  assert.equal($('#s-out').textContent, fmt(67));
  assert.equal($('#conn-text').textContent, 'Fabric RTI: conectado');
});
