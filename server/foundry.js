// Cliente do Microsoft Foundry Agent Service (Responses API).
// Autenticação via Entra ID (DefaultAzureCredential): az login, managed identity, etc.
import { getCredential } from './fabric.js';

const cfg = () => ({
  endpoint: process.env.FOUNDRY_PROJECT_ENDPOINT?.replace(/\/$/, ''),
  agentName: process.env.FOUNDRY_AGENT_NAME || process.env.FOUNDRY_AGENT_ID,
  legacyAgentId: process.env.FOUNDRY_AGENT_ID,
  apiVersion: process.env.FOUNDRY_API_VERSION || 'v1',
  scope: process.env.FOUNDRY_SCOPE || 'https://ai.azure.com/.default',
  timeoutMs: Number(process.env.FOUNDRY_TIMEOUT_MS || 60000),
  debug: process.env.FOUNDRY_DEBUG === 'true',
});

export const foundryConfigured = () => { const c = cfg(); return !!(c.endpoint && c.agentName); };

function logDebug(label, value) {
  console.log(`[foundry][debug] ${label}`);
  if (value !== undefined) console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}

async function call(c, method, path, body) {
  const { token } = await getCredential().getToken(c.scope);
  const sep = path.includes('?') ? '&' : '?';
  const requestBody = body ? JSON.stringify(body) : undefined;
  if (c.debug && requestBody !== undefined) {
    logDebug(`Payload enviado ao Foundry · ${method} ${path}:`, requestBody);
  }
  const res = await fetch(`${c.endpoint}${path}${sep}api-version=${c.apiVersion}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: requestBody,
  });
  const text = await res.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); } catch {
      if (res.ok) throw new Error('Foundry retornou uma resposta JSON inválida.');
    }
  }
  if (!res.ok) throw new Error(`Foundry ${res.status}: ${data.error?.message || text.slice(0, 300)}`);
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function chatWithClassicAgent(c, { message, threadId }) {
  let run;
  if (threadId) {
    await call(c, 'POST', `/threads/${threadId}/messages`, { role: 'user', content: message });
    run = await call(c, 'POST', `/threads/${threadId}/runs`, { assistant_id: c.legacyAgentId });
  } else {
    run = await call(c, 'POST', '/threads/runs', {
      assistant_id: c.legacyAgentId,
      thread: { messages: [{ role: 'user', content: message }] },
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
  const reply = (list.data || []).find((m) => m.role === 'assistant' && m.run_id === run.id);
  const text = (reply?.content || [])
    .filter((p) => p.type === 'text')
    .map((p) => p.text.value)
    .join('\n');
  if (!text.trim()) throw new Error('Foundry concluiu a execução, mas não retornou texto para essa mensagem.');
  return { text, conversationId: threadId, runId: run.id };
}

function getResponseText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  return (response.output || [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content || [])
    .filter((part) => part.type === 'output_text' || part.type === 'text')
    .map((part) => part.text || '')
    .join('\n');
}

async function chatWithCurrentAgent(c, { message, conversationId }) {
  const agentPath = `/agents/${encodeURIComponent(c.agentName)}/endpoint/protocols/openai`;
  if (!conversationId) {
    const conversation = await call(c, 'POST', `${agentPath}/conversations`, {});
    conversationId = conversation.id;
    if (typeof conversationId !== 'string' || !conversationId) {
      throw new Error('Foundry não retornou o ID da conversa.');
    }
  }

  const response = await call(c, 'POST', `${agentPath}/responses`, {
    conversation: conversationId,
    input: message,
  });
  if (response.status !== 'completed') {
    throw new Error(`Foundry não concluiu a resposta${response.status ? ` (status: ${response.status})` : ''}.`);
  }
  const text = getResponseText(response);
  if (!text.trim()) throw new Error('Foundry concluiu a execução, mas não retornou texto.');
  return {
    text,
    conversationId,
    runId: response.id,
  };
}

export async function chat({ message, conversationId, threadId }) {
  const c = cfg();
  if (!foundryConfigured()) {
    throw Object.assign(new Error('Agente Foundry não configurado (FOUNDRY_PROJECT_ENDPOINT / FOUNDRY_AGENT_NAME).'), { status: 503 });
  }

  const classic = c.legacyAgentId?.startsWith('asst_') && !process.env.FOUNDRY_AGENT_NAME;
  const activeConversationId = conversationId || threadId;
  const startedAt = Date.now();
  if (c.debug) {
    logDebug(`Requisição recebida · agente=${classic ? 'clássico' : c.agentName} · conversa=${activeConversationId?.slice(-6) || 'nova'}`);
    logDebug('Mensagem do usuário:', message);
  }

  try {
    // IDs asst_ pertencem ao Agent Service clássico; agentes criados na nova UI
    // usam nomes e a Responses API com conversas.
    const result = classic
      ? await chatWithClassicAgent(c, { message, threadId: activeConversationId })
      : await chatWithCurrentAgent(c, { message, conversationId: activeConversationId });
    if (c.debug) {
      logDebug(`Resposta do agente · conversa=${result.conversationId?.slice(-6) || '—'} · duração=${Date.now() - startedAt}ms`);
      logDebug('Mensagem do agente:', result.text);
    }
    return result;
  } catch (error) {
    if (c.debug) logDebug(`Falha após ${Date.now() - startedAt}ms:`, error.message);
    throw error;
  }
}
