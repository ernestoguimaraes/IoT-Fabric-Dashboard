// Adaptador do agente no Azure AI Foundry (via proxy /api/agent/chat).
// O proxy mantém a credencial (DefaultAzureCredential) e devolve o threadId para
// continuar a conversa.

export function createFoundryAgent({ apiBase = '' } = {}) {
  let threadId = null;
  return {
    mode: 'foundry',
    label: 'Azure AI Foundry Agent',
    async send(text, context) {
      const res = await fetch(`${apiBase}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, context, threadId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      threadId = data.threadId || threadId;
      return { text: data.text, source: `Foundry · thread ${threadId?.slice(-6) || '—'}` };
    },
    reset() { threadId = null; },
  };
}
