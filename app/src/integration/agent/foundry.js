// Adaptador do agente no Azure AI Foundry (via proxy /api/agent/chat).
// O proxy mantém a credencial (DefaultAzureCredential) e devolve o conversationId
// para continuar a conversa.

export function createFoundryAgent({ apiBase = '' } = {}) {
  let conversationId = null;
  return {
    mode: 'foundry',
    label: 'Microsoft Foundry Agent',
    async send(text) {
      const res = await fetch(`${apiBase}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId }),
      });
      const data = await res.json().catch(() => ({}));
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
    reset() { conversationId = null; },
  };
}
