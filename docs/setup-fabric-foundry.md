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

1. Se ainda não existir um `.env`, copie o modelo no PowerShell: `Copy-Item .\.env.example .\.env` (não sobrescreva uma configuração existente e não versione o `.env`).
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

### Configurar e obter a ingestão em tempo real (Real-Time Intelligence)

Neste projeto não existe uma chave única chamada "Real-Time Ingestion". Você precisa de **uma connection string para enviar eventos** e de **uma Query URI para consultar os dados**. O fluxo é: dispositivo/simulador → Eventstream → Eventhouse → proxy → SPA.

**1. Criar os recursos no Fabric**

No [portal do Fabric](https://app.fabric.microsoft.com), use um workspace com capacidade Fabric ou Trial e permissão Contributor ou superior para criar os recursos. Crie um **Eventhouse** e um banco KQL (por exemplo, `IoTFactory`). Abra o banco e execute cada comando abaixo separadamente, se as tabelas ainda não existirem:

```kusto
.create table MachineTelemetry (eventType:string, machineId:string, ts:datetime, temp:real, vib:real, usage:int, mode:string, speed:int)
.create table MachineParams (eventType:string, machineId:string, ts:datetime, source:string, mode:string, speed:int, targetTemp:real, tempLimit:real, vibLimit:real, cycleTime:int)
.create table MachineCommands (eventType:string, machineId:string, ts:datetime, source:string, command:string)
```

**2. Obter o endereço e a chave para enviar eventos**

Crie um **Eventstream** no workspace. Em **Edit**, selecione **Add source → Custom endpoint**, dê um nome à fonte e selecione **Publish**. Em **Live view**, selecione essa fonte e abra **Details → Event Hub → SAS Key Authentication**. Os nomes podem variar conforme o idioma e a experiência do portal.

Copie **Connection string-primary key** (ou a secundária) inteira para `FABRIC_EVENTSTREAM_CONNECTION_STRING`. Não copie apenas a Primary key, nem a string Kafka/AMQP. Se a string não tiver `EntityPath`, copie também **Event hub name** para `FABRIC_EVENTSTREAM_NAME`.

```env
FABRIC_EVENTSTREAM_CONNECTION_STRING="Endpoint=sb://<endpoint>/;SharedAccessKeyName=<nome>;SharedAccessKey=<chave>;EntityPath=<event-hub>"
FABRIC_EVENTSTREAM_NAME=
```

A string é um segredo: mantenha-a somente no `.env` local ou no gerenciador de segredos do ambiente.

**3. Obter o endereço para ler a telemetria**

Abra o **banco KQL** do Eventhouse e, nos detalhes do banco, copie **Query URI** para `FABRIC_KUSTO_URI` e o nome do banco para `FABRIC_KUSTO_DATABASE`. Use o valor completo exibido pelo portal; não construa a URI a partir do nome do recurso.

Não use **Ingestion URI** nessa variável: `server/fabric.js` chama a API de consulta `/v1/rest/query`. Neste projeto, o envio é feito pela connection string do Eventstream, e não pela Ingestion URI do Eventhouse.

```env
VITE_TELEMETRY_MODE=fabric
FABRIC_KUSTO_URI=https://<query-uri-copiada-do-portal>
FABRIC_KUSTO_DATABASE=IoTFactory
FABRIC_LOOPBACK=false
FABRIC_POLL_MS=3000
FABRIC_STALE_SEC=15
```

Autentique com `az login` na conta/tenant que tem acesso ao banco. Essa identidade precisa de permissão de consulta (Viewer no banco, ou equivalente); a chave SAS usada no envio não concede acesso às consultas.

**4. Conectar o Eventstream às tabelas**

No editor do Eventstream, adicione três ramificações **Filter**, uma para cada valor de `eventType` da tabela acima. Em cada saída, adicione um destino **Eventhouse**, selecione **Event processing before ingestion**, o workspace, o banco e a tabela correspondente. Configure os campos JSON com os mesmos nomes e tipos das tabelas; `ts` deve ser `datetime`. Publique as alterações.

Esse modo permite filtrar os três formatos de evento antes da ingestão. Se a experiência do portal solicitar amostras para configurar o mapeamento, inicie o simulador após preencher a connection string e gere também um ajuste de parâmetros ou comando pela SPA para obter exemplos desses eventos.

**5. Enviar dados e conferir a chegada**

Depois de preencher o `.env`, inicie os serviços na raiz do repositório, em dois terminais:

```powershell
# Terminal 1: SPA e proxy (reinicie se já estavam abertos)
npm run dev:all

# Terminal 2: dispositivos de demonstração enviando ao Eventstream real
npm run simulate:devices
```

No Eventstream, a **Live view/Data preview** permite inspecionar os eventos. No banco KQL, confirme que houve ingestão com:

```kusto
MachineTelemetry
| where ts > ago(10m)
| extend ingestedAt = ingestion_time()
| project machineId, ts, ingestedAt, temp, vib, usage
| top 20 by ts desc
```

Abra <http://localhost:5173> e confira **Sincronização Fabric RTI**. A SPA consulta os dados pelo proxy em intervalos de `FABRIC_POLL_MS` e recebe as atualizações via SSE; não é uma conexão direta do navegador ao Fabric nem uma garantia de latência instantânea.

Se não aparecerem dados: confira se a fonte e os destinos foram publicados, se os filtros e o mapeamento JSON estão corretos, e se os horários `ts` são atuais. O proxy só consulta os últimos 10 minutos e só aceita os IDs de máquinas cadastrados em `app/src/shared/machines.js`. O `ROB-003` começa sem comunicação no simulador, portanto não espere necessariamente 16 máquinas recebendo dados. Se houver atraso de ingestão superior a 15 segundos, investigue-o e ajuste `FABRIC_STALE_SEC` conforme a tolerância desejada; alterar esse limite não acelera a ingestão.

Referências oficiais: [criar Custom endpoint e copiar a connection string](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/event-streams/add-source-custom-app) e [configurar o destino Eventhouse](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/event-streams/add-destination-kql-database).

### Testar sem Fabric (loopback)

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

- `GET http://localhost:8787/api/health` mostra `fabric.eventstream`, `fabric.eventhouse` e `foundry.configured` como `true` quando as variáveis correspondentes estão preenchidas. Esses indicadores verificam presença de configuração, não testam credenciais, permissões nem chegada de eventos; confirme também com a consulta KQL e a SPA.
- No modo Fabric, o painel **Sincronização Fabric RTI** deve ficar conectado. Sem leituras, rode `npm run simulate:devices` em outro terminal.
- No modo Foundry, abra o assistente e envie uma mensagem. Falha de credencial ou nome de agente aparece no chat e no log do proxy.
