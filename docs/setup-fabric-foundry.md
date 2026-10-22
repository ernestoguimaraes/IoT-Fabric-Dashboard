# Setup do Fabric Eventstream e do agente Foundry

Resumo para ligar a SPA ao **Microsoft Fabric Real-Time Intelligence** e ao **Microsoft Foundry**. O foco é o arquivo `.env` na raiz do projeto. Credenciais ficam só no proxy; não as coloque em variáveis `VITE_*`.

## Arquivos e localização

Tudo parte da raiz do repositório. O `.env` fica ao lado de `package.json`, não dentro de `app/`. O Vite usa essa raiz como `envDir` e só expõe ao navegador as variáveis `VITE_*`.

| Arquivo | Função |
|---|---|
| `.env.example` | Modelo versionado. Copie para `.env`. |
| `.env` | Configuração local. Não versionar. |
| `vite.config.js` | Porta `5173` e proxy de `/api` para `API_PORT`. |
| `app/index.html` | Entrada da SPA, servida em <http://localhost:5173>. |
| `app/src/main.js` | Lê `VITE_TELEMETRY_MODE` e `VITE_AGENT_MODE`. |
| `app/src/integration/telemetry/` | Adaptadores `mock` e `fabric` (`VITE_API_BASE`). |
| `app/src/integration/agent/` | Adaptadores `mock` e `foundry` (`VITE_API_BASE`, `VITE_AGENT_DEBUG`). |
| `server/index.js` | Proxy em `http://localhost:8787`: SSE, parâmetros, comandos e chat. |
| `server/fabric.js` | Lê as variáveis `FABRIC_*` e publica/consulta o Fabric. |
| `server/foundry.js` | Lê as variáveis `FOUNDRY_*` e chama o agente. |
| `server/deviceSimulator.js` | `npm run simulate:devices`; usa `DEVICE_INTERVAL_MS` e o Eventstream. |

Na interface, a telemetria aparece no painel direito **Sincronização Fabric RTI**. O agente abre pelo botão **Assistente IoT**, no canto da página.

## Antes de editar o `.env`

1. Copie o modelo: `copy .env.example .env` (não versione o `.env`).
2. Autentique a identidade do proxy: `az login`. O servidor usa `DefaultAzureCredential` para Eventhouse e Foundry.
3. Depois de alterar o `.env`, reinicie o ambiente (`.\dev.ps1 restart` ou `npm run dev:all`). O Vite só lê variáveis `VITE_*` na inicialização.

Sem Fabric e sem Foundry, deixe os padrões (`VITE_TELEMETRY_MODE=mock` e `VITE_AGENT_MODE=mock`) e use `npm run dev`.

## Fabric Eventstream + Eventhouse

No Fabric, crie um Eventhouse com as tabelas `MachineTelemetry`, `MachineParams` e `MachineCommands`, e um Eventstream com fonte **Custom endpoint** (protocolo Event Hubs). Roteie o destino pelo campo `eventType`:

| `eventType` | Tabela |
|---|---|
| `telemetry` | `MachineTelemetry` |
| `params` | `MachineParams` |
| `command` | `MachineCommands` |

A connection string SAS publica eventos. A leitura do Eventhouse usa a identidade do `az login` (permissão de consulta no banco KQL).

Bloco mínimo no `.env`:

```env
VITE_TELEMETRY_MODE=fabric

FABRIC_EVENTSTREAM_CONNECTION_STRING=Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=...;EntityPath=...
FABRIC_EVENTSTREAM_NAME=
FABRIC_KUSTO_URI=https://<eventhouse>.kusto.fabric.microsoft.com
FABRIC_KUSTO_DATABASE=IoTFactory
FABRIC_KUSTO_SCOPE=https://kusto.kusto.windows.net/.default
FABRIC_TELEMETRY_TABLE=MachineTelemetry
FABRIC_PARAMS_TABLE=MachineParams
FABRIC_POLL_MS=3000
FABRIC_LOOPBACK=false
DEVICE_INTERVAL_MS=2000
```

| Variável | Lida em | De onde vem |
|---|---|---|
| `VITE_TELEMETRY_MODE` | `app/src/main.js` | `fabric` para usar o proxy; `mock` fica no navegador. |
| `FABRIC_EVENTSTREAM_CONNECTION_STRING` | `server/fabric.js` | Eventstream → fonte Custom endpoint → connection string Event Hubs. Se já tiver `EntityPath`, deixe `FABRIC_EVENTSTREAM_NAME` vazio. |
| `FABRIC_KUSTO_URI` | `server/fabric.js` | Eventhouse → Query URI, sem barra no final. |
| `FABRIC_KUSTO_DATABASE` | `server/fabric.js` | Nome do banco KQL. |
| `FABRIC_TELEMETRY_TABLE` / `FABRIC_PARAMS_TABLE` | `server/fabric.js` | Nomes das tabelas. O padrão já corresponde ao roteamento acima. |
| `FABRIC_POLL_MS` | `server/fabric.js` | Intervalo em que o proxy consulta o Eventhouse. |
| `DEVICE_INTERVAL_MS` | `server/deviceSimulator.js` | Intervalo do `npm run simulate:devices`. |

Opcional, não está no `.env.example`: `FABRIC_STALE_SEC=15`. Leituras mais antigas que isso aparecem como sem comunicação.

Para exercitar o adaptador `fabric` sem recursos Azure, use só isto e não preencha connection string nem Kusto:

```env
VITE_TELEMETRY_MODE=fabric
FABRIC_LOOPBACK=true
```

## Agente Foundry

Na UI do Foundry, crie um agente de prompt no projeto e anote o **nome** do agente (não o ID `asst_...`, salvo no caso legado abaixo). Conceda à mesma identidade do `az login` o papel **Azure AI User** no projeto.

O endpoint do projeto tem a forma `https://<recurso>.services.ai.azure.com/api/projects/<projeto>`.

Bloco mínimo no `.env`:

```env
VITE_AGENT_MODE=foundry

FOUNDRY_PROJECT_ENDPOINT=https://<recurso>.services.ai.azure.com/api/projects/<projeto>
FOUNDRY_AGENT_NAME=<nome-do-agente>
FOUNDRY_API_VERSION=v1
FOUNDRY_SCOPE=https://ai.azure.com/.default
FOUNDRY_DEBUG=false
```

| Variável | Lida em | De onde vem |
|---|---|---|
| `VITE_AGENT_MODE` | `app/src/main.js` | `foundry` para o agente real; `mock` fica no navegador. |
| `FOUNDRY_PROJECT_ENDPOINT` | `server/foundry.js` | Projeto Foundry → endpoint da API de projetos. Sem barra no final. |
| `FOUNDRY_AGENT_NAME` | `server/foundry.js` | Nome do agente criado na UI atual. |
| `FOUNDRY_API_VERSION` | `server/foundry.js` | Deixe `v1`, a menos que o projeto exija outra versão. |
| `FOUNDRY_SCOPE` | `server/foundry.js` | Escopo Entra ID; o padrão acima é o usado pelo proxy. |
| `FOUNDRY_DEBUG` | `server/foundry.js` | `true` só para depurar: grava pergunta, payload e resposta no console do proxy. |

Agente clássico (`asst_...`), somente se **não** definir `FOUNDRY_AGENT_NAME`:

```env
FOUNDRY_AGENT_ID=asst_...
```

`VITE_AGENT_DEBUG=true` ou `false` controla o log no navegador. Vazio mantém o log ligado em `npm run dev`.

## Os dois juntos

```env
VITE_TELEMETRY_MODE=fabric
VITE_AGENT_MODE=foundry
API_PORT=8787

FABRIC_EVENTSTREAM_CONNECTION_STRING=Endpoint=sb://...
FABRIC_KUSTO_URI=https://<eventhouse>.kusto.fabric.microsoft.com
FABRIC_KUSTO_DATABASE=IoTFactory

FOUNDRY_PROJECT_ENDPOINT=https://<recurso>.services.ai.azure.com/api/projects/<projeto>
FOUNDRY_AGENT_NAME=<nome-do-agente>
```

Suba SPA e proxy juntos: `npm run dev:all` ou `.\dev.ps1 start`. Abra <http://localhost:5173>.

## Conferir

- `GET http://localhost:8787/api/health` deve mostrar `fabric.eventstream`, `fabric.eventhouse` e `foundry.configured` como `true` quando as variáveis correspondentes estão preenchidas.
- No modo Fabric, o painel **Sincronização Fabric RTI** deve ficar conectado. Sem leituras, rode `npm run simulate:devices` em outro terminal.
- No modo Foundry, abra o assistente e envie uma mensagem. Falha de credencial ou nome de agente aparece no chat e no log do proxy.
