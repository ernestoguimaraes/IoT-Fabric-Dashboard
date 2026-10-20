import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';

const context = { summary: { online: 1, alert: 0, offline: 0, total: 1 }, alerts: [], machines: [], selected: null };
let nodes;
let subscriptions;
let contextReads;

function node() {
  return {
    children: [], style: {}, dataset: {}, listeners: {}, value: '',
    classList: { add() {}, remove() {} },
    append(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; },
    addEventListener(name, fn) { this.listeners[name] = fn; },
    focus() {},
    remove() { for (const n of nodes.values()) n.children = n.children.filter((child) => child !== this); },
  };
}
const getNode = (id) => {
  if (!nodes.has(id)) nodes.set(id, node());
  return nodes.get(id);
};

mock.module('../server/fabric.js', {
  exports: { getCredential: () => ({ getToken: async () => ({ token: 'test-token' }) }) },
});
mock.module('../app/src/state.js', {
  exports: { store: { state: {}, subscribe: (...args) => subscriptions.push(args) } },
});
mock.module('../app/src/integration/agent/context.js', {
  exports: { buildContext: () => { contextReads++; return context; } },
});
mock.module('../app/src/ui/dom.js', {
  exports: {
    $: getNode,
    el: (_tag, attrs = {}, text = '') => Object.assign(node(), { className: attrs.class, textContent: text }),
    esc: (text) => String(text),
    setText: (n, text) => { n.textContent = text; },
  },
});

const { chat } = await import('../server/foundry.js');
const { createFoundryAgent } = await import('../app/src/integration/agent/foundry.js');
const { createAgent } = await import('../app/src/integration/agent/index.js');
const { answer } = await import('../app/src/integration/agent/mock.js');
const { mountAssistant } = await import('../app/src/ui/assistant.js');
let previousEnv;

beforeEach(() => {
  previousEnv = { ...process.env };
  process.env.FOUNDRY_PROJECT_ENDPOINT = 'https://foundry.test';
  process.env.FOUNDRY_AGENT_NAME = 'test-agent';
  process.env.FOUNDRY_DEBUG = 'false';
  delete process.env.FOUNDRY_AGENT_ID;
  nodes = new Map();
  subscriptions = [];
  contextReads = 0;
});
afterEach(() => {
  mock.restoreAll();
  process.env = previousEnv;
});

test('Foundry forwards only the exact user message and preserves remote conversation and reply', async () => {
  const bodies = [];
  const reply = '  Resposta do agente 【1:fonte】\n';
  mock.method(globalThis, 'fetch', async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    return new Response(JSON.stringify(bodies.length === 1
      ? { id: 'conv_test' }
      : { id: 'resp_test', status: 'completed', output_text: reply }));
  });
  const message = '  teste\n';
  const result = await chat({ message, context });
  assert.deepEqual(bodies, [{}, { conversation: 'conv_test', input: message }]);
  assert.equal(result.text, reply);
  await chat({ message: 'segunda mensagem', context, conversationId: result.conversationId });
  assert.deepEqual(bodies[2], { conversation: 'conv_test', input: 'segunda mensagem' });
});

test('classic Foundry uses no additional instructions and preserves citations', async () => {
  delete process.env.FOUNDRY_AGENT_NAME;
  process.env.FOUNDRY_AGENT_ID = 'asst_test';
  const requests = [];
  mock.method(globalThis, 'fetch', async (_url, options) => {
    if (options.body) {
      requests.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ id: 'run_test', thread_id: 'thread_test', status: 'completed' }));
    }
    return new Response(JSON.stringify({ data: [
      { role: 'assistant', run_id: 'run_test', content: [{ type: 'text', text: { value: 'Resposta 【1:fonte】' } }] },
    ] }));
  });
  const result = await chat({ message: 'teste', context });
  assert.deepEqual(requests, [{ assistant_id: 'asst_test', thread: { messages: [{ role: 'user', content: 'teste' }] } }]);
  assert.equal(result.text, 'Resposta 【1:fonte】');
});

test('Foundry rejects failed, incomplete and empty responses instead of substituting text', async () => {
  const fetch = mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: { message: 'unavailable' } }), { status: 503 }));
  await assert.rejects(chat({ message: 'teste', conversationId: 'conv_test' }), /Foundry 503/);
  for (const response of [
    { status: 'failed', output_text: 'partial' },
    { status: 'incomplete', output_text: 'partial' },
    { status: 'completed', output_text: '   ' },
  ]) {
    fetch.mock.mockImplementation(async () => new Response(JSON.stringify(response)));
    await assert.rejects(chat({ message: 'teste', conversationId: 'conv_test' }), /não concluiu|não retornou texto/);
  }
});

test('debug logs the exact outgoing message without local context or credentials', async () => {
  process.env.FOUNDRY_DEBUG = 'true';
  const logs = [];
  const requests = [];
  mock.method(console, 'log', (...args) => logs.push(args));
  mock.method(globalThis, 'fetch', async (_url, options) => {
    requests.push(options.body);
    return new Response(JSON.stringify({ id: 'resp_test', status: 'completed', output_text: 'Resposta' }));
  });
  await chat({ message: 'teste', conversationId: 'conv_test', context });
  const index = logs.findIndex(([label]) => label.includes('Payload enviado ao Foundry'));
  assert.ok(index >= 0);
  assert.equal(logs[index + 1][0], requests[0]);
  assert.deepEqual(JSON.parse(requests[0]), { conversation: 'conv_test', input: 'teste' });
  assert.ok(!JSON.stringify(logs).includes('test-token'));
  assert.ok(!JSON.stringify(logs).includes('summary'));
});

test('classic Foundry rejects old replies from a different run', async () => {
  delete process.env.FOUNDRY_AGENT_NAME;
  process.env.FOUNDRY_AGENT_ID = 'asst_test';
  mock.method(globalThis, 'fetch', async (_url, options) => new Response(JSON.stringify(options.body
    ? { id: 'run_new', thread_id: 'thread_test', status: 'completed' }
    : { data: [{ role: 'assistant', run_id: 'run_old', content: [{ type: 'text', text: { value: 'old reply' } }] }] })));
  await assert.rejects(chat({ message: 'teste' }), /não retornou texto/);
});

test('adapter excludes context, reuses conversation and resets it', async () => {
  const requests = [];
  mock.method(globalThis, 'fetch', async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ text: 'Resposta', conversationId: 'conv_test' }));
  });
  const agent = createFoundryAgent();
  await agent.send('  teste  ', context);
  await agent.send('segunda');
  agent.reset();
  await agent.send('nova');
  assert.deepEqual(requests, [
    { message: '  teste  ', conversationId: null },
    { message: 'segunda', conversationId: 'conv_test' },
    { message: 'nova', conversationId: null },
  ]);
});

test('Foundry adapter surfaces failures and empty replies without local substitution', async () => {
  const agent = createAgent('foundry');
  mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'Foundry indisponivel' }), { status: 503 }));
  await assert.rejects(agent.send('teste'), /Foundry indisponivel/);
  globalThis.fetch.mock.mockImplementation(async () => new Response(JSON.stringify({ text: '', conversationId: 'conv_test' })));
  await assert.rejects(agent.send('teste'), /não retornou uma resposta de texto/);
  assert.throws(() => createAgent('invalid'), /Modo de agente inválido/);
});

test('Foundry UI has no local greeting, suggestions, context or automatic machine prompt', async () => {
  const calls = [];
  const assistant = mountAssistant({ mode: 'foundry', label: 'Foundry', reset() {}, send: async (...args) => {
    calls.push(args);
    return { text: 'Resposta remota' };
  } });
  assistant.open('Como funciona a INJ-002?');
  assert.equal(getNode('#as-msgs').children.length, 0);
  assert.equal(getNode('#as-ctx').style.display, 'none');
  assert.equal(getNode('#as-chips').style.display, 'none');
  assert.equal(subscriptions.length, 0);
  await assistant.ask('  mensagem digitada  ');
  assert.deepEqual(calls, [['  mensagem digitada  ']]);
  assert.equal(contextReads, 0);
  assert.equal(getNode('#as-msgs').children.at(-1).innerHTML, 'Resposta remota');
  getNode('#as-clear').listeners.click();
  assert.equal(getNode('#as-msgs').children.length, 0);
});

test('mock UI retains greeting, context, suggestions and automatic machine prompt', async () => {
  const calls = [];
  const assistant = mountAssistant({ mode: 'mock', label: 'Mock', reset() {}, send: async (...args) => {
    calls.push(args);
    return { text: 'Resposta local' };
  } });
  assistant.open();
  assert.match(getNode('#as-msgs').children[0].innerHTML, /Olá! Sou o assistente da Linha A/);
  assert.equal(subscriptions.length, 1);
  subscriptions[0][1]({ selectedId: null, machines: [] });
  assert.equal(getNode('#as-chips').children.length, 3);
  assert.equal(getNode('#as-ctx').style.display, '');
  assistant.open('Resumo da planta');
  await Promise.resolve();
  assert.deepEqual(calls, [['Resumo da planta', context]]);
  assert.equal(contextReads, 1);
  assert.equal(createAgent('mock').mode, 'mock');
  assert.match(answer('Resumo da planta', context), /Planta: 1 online, 0 em alerta, 0 offline/);
  getNode('#as-clear').listeners.click();
  assert.equal(getNode('#as-msgs').children.length, 1);
});
