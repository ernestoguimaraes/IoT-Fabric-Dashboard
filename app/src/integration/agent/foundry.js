// Adaptador do agente no Azure AI Foundry (via proxy /api/agent/chat).
// O proxy mantém a credencial (DefaultAzureCredential) e devolve o conversationId
// para continuar a conversa.

export function createFoundryAgent({ apiBase = '', debug = false } = {}) {
  let conversationId = null;
  const log = (...args) => { if (debug) console.log('[foundry]', ...args); };
  return {
    mode: 'foundry',
    label: 'Microsoft Foundry Agent',
    // context (opcional): snapshot da planta/alertas, anexado à pergunta pelo proxy.
    async send(text, context) {
      const t0 = performance.now();
      log('→ POST /api/agent/chat', { message: text, conversationId, context });
      const res = await fetch(`${apiBase}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId, context }),
      });
      const data = await res.json().catch(() => ({}));
      log(`← HTTP ${res.status} em ${Math.round(performance.now() - t0)}ms`, data);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (typeof data.text !== 'string' || !data.text.trim()) {
        throw new Error('Foundry não retornou uma resposta de texto.');
      }
      if (typeof data.conversationId !== 'string' || !data.conversationId) {
        throw new Error('Foundry não retornou o ID da conversa.');
      }
      conversationId = data.conversationId;
      return { text: data.text, source: `Foundry · conversa ${conversationId.slice(-6)}` };
    },
    reset() { log('conversa reiniciada'); conversationId = null; },
  };
}
