// Cliente do Azure AI Foundry Agent Service (REST, threads/runs).
// Autenticação via Entra ID (DefaultAzureCredential): az login, managed identity, etc.
import { getCredential } from './fabric.js';

const cfg = () => ({
  endpoint: process.env.FOUNDRY_PROJECT_ENDPOINT?.replace(/\/$/, ''),
  agentId: process.env.FOUNDRY_AGENT_ID,
  apiVersion: process.env.FOUNDRY_API_VERSION || 'v1',
  scope: process.env.FOUNDRY_SCOPE || 'https://ai.azure.com/.default',
  timeoutMs: Number(process.env.FOUNDRY_TIMEOUT_MS || 60000),
});

export const foundryConfigured = () => { const c = cfg(); return !!(c.endpoint && c.agentId); };

async function call(c, method, path, body) {
  const { token } = await getCredential().getToken(c.scope);
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${c.endpoint}${path}${sep}api-version=${c.apiVersion}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`Foundry ${res.status}: ${data.error?.message || text.slice(0, 300)}`);
  return data;
}

// Contexto ao vivo da planta enviado como instruções adicionais do run (não fica no histórico da thread).
function contextInstructions(context) {
  if (!context) return undefined;
  return [
    'Contexto em tempo real do painel IoT (JSON). Use-o para responder sobre status, alarmes e parâmetros; não invente valores.',
    'Responda em português do Brasil, de forma objetiva, e cite o código da máquina (ex.: INJ-002).',
    JSON.stringify(context),
  ].join('\n');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function chat({ message, context, threadId }) {
  const c = cfg();
  if (!foundryConfigured()) {
    throw Object.assign(new Error('Agente Foundry não configurado (FOUNDRY_PROJECT_ENDPOINT / FOUNDRY_AGENT_ID).'), { status: 503 });
  }
  const additional_instructions = contextInstructions(context);
  let run;
  if (threadId) {
    await call(c, 'POST', `/threads/${threadId}/messages`, { role: 'user', content: message });
    run = await call(c, 'POST', `/threads/${threadId}/runs`, { assistant_id: c.agentId, additional_instructions });
  } else {
    run = await call(c, 'POST', '/threads/runs', {
      assistant_id: c.agentId,
      thread: { messages: [{ role: 'user', content: message }] },
      additional_instructions,
    });
    threadId = run.thread_id;
  }

  const t0 = Date.now();
  while (['queued', 'in_progress', 'cancelling'].includes(run.status)) {
    if (Date.now() - t0 > c.timeoutMs) throw new Error('Tempo esgotado aguardando o agente.');
    await sleep(700);
    run = await call(c, 'GET', `/threads/${threadId}/runs/${run.id}`);
  }
  if (run.status !== 'completed') {
    throw new Error(`Run ${run.status}${run.last_error?.message ? `: ${run.last_error.message}` : ''}`);
  }

  const list = await call(c, 'GET', `/threads/${threadId}/messages?order=desc&limit=10`);
  const reply = (list.data || []).find((m) => m.role === 'assistant' && m.run_id === run.id)
    || (list.data || []).find((m) => m.role === 'assistant');
  const text = (reply?.content || [])
    .filter((p) => p.type === 'text')
    .map((p) => p.text.value.replace(/【[^】]*】/g, '')) // remove marcadores de citação
    .join('\n').trim();
  return { text: text || '(o agente não retornou texto)', threadId, runId: run.id };
}
