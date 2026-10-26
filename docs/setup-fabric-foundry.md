# Setup do Fabric Eventstream e do agente Foundry

Guia para ligar a SPA ao **Microsoft Fabric Real-Time Intelligence** e ao **Microsoft Foundry**. O `.env` fica na raiz, ao lado de `package.json`, não dentro de `app/`. Credenciais ficam no servidor; nunca em variáveis `VITE_*`, que podem ser expostas ao navegador.

## Arquivos e localização

| Arquivo | Função |
|---|---|
| `.env.example` | Modelo versionado; copie para `.env` sem sobrescrever configurações existentes. |
| `.env` | Configuração local; não versionar. |
| `vite.config.js` | Porta `5173`, `envDir` na raiz e proxy de `/api` para `API_PORT`. |
| `app/index.html` | Entrada da SPA. |
| `app/src/main.js` | Seleciona os modos de telemetria e agente. |
| `app/src/integration/telemetry/` | Adaptadores mock e Fabric; usam `VITE_API_BASE` opcional. |
| `app/src/integration/agent/` | Adaptadores mock e Foundry. |
| `server/index.js` | Proxy: SSE, controle HTTP local e chat. |
| `server/deviceControl.js` | Estado desejado em memória para os dispositivos simulados. |
| `server/fabric.js` | Publicação de telemetria e consultas ao Eventhouse. |
| `server/deviceSimulator.js` | Busca controle no proxy, simula os dispositivos e publica telemetria. |
| `server/foundry.js` | Integração com o agente Foundry. |

## Antes de editar o `.env`

1. Se ainda não existir `.env`, execute `Copy-Item .\.env.example .\.env` no PowerShell.
2. Autentique a identidade de consulta com `az login`, na conta/tenant que tem acesso aos recursos.
3. Após alterar o `.env`, reinicie SPA e proxy com `.\dev.ps1 restart` ou reinicie `npm run dev:all`. Reinicie também o simulador se alterou suas configurações.

Sem Fabric nem Foundry, use `VITE_TELEMETRY_MODE=mock`, `VITE_AGENT_MODE=mock` e `npm run dev`.

## Fabric Eventstream + Eventhouse

O Fabric recebe **somente `eventType=telemetry`**, em uma única tabela, `MachineTelemetry`.

```text
Controle:   UI -> proxy HTTP -> simulador
Telemetria: simulador -> Eventstream -> MachineTelemetry -> proxy SSE -> UI
```

Comandos e parâmetros continuam existindo como ações da UI, mas não como fluxos ou tabelas no Fabric. Ao parar uma empilhadeira, o simulador aplica o controle e publica a telemetria resultante com `mode=off`, `speed=0` e **`isRunning=false`**. Temperatura, vibração e utilização convergem pelo modelo físico da simulação; não zeram necessariamente no mesmo instante.

### Equipamento parado ou em funcionamento

O campo JSON **`isRunning`**, do tipo booleano, registra o estado operacional do dispositivo no instante `ts`:

| Valor | Significado no simulador |
|---|---|
| `true` | Em funcionamento: modo `auto` ou `manual` com velocidade efetiva maior que zero. |
| `false` | Parado: modo `off`, modo `paused` ou velocidade zero, mesmo que ainda exista temperatura, vibração ou utilização residual. |

O simulador calcula o campo depois de aplicar o controle, pela velocidade efetiva do modelo, não por uma estimativa baseada em `usage`. Em equipamentos reais, o produtor deve obter esse estado do dispositivo/controlador; um comando enviado não comprova execução física.

**Início da demonstração:** UI, proxy e simulador usam o mesmo cadastro inicial e a mesma regra para `isRunning`. As 16 máquinas começam com comunicação e enviam telemetria. Quinze começam em `auto`, velocidade 100 e `isRunning=true`; o `ROB-003` começa parado, em `off`, velocidade zero e `isRunning=false`. Não há um terceiro estado nem envio de `null` nesse campo. Uma máquina em alerta de temperatura ou vibração ainda pode estar em funcionamento.

O primeiro lote é uma fotografia dos valores iniciais (`temp`, `vib`, `usage`, `mode`, `speed`, `isRunning`), antes de aplicar ruído ou evolução física. Os ciclos seguintes simulam a evolução normalmente. O mock do navegador e o loopback seguem a mesma regra. Antes de publicar, o simulador consulta o controle do proxy: comandos já aceitos são respeitados, não sobrescritos por um reinício do simulador.

Para começar uma demonstração limpa, reinicie proxy e simulador e recarregue a SPA. Reiniciar apenas a SPA não reinicia o dispositivo nem apaga controles existentes. O estado inicial da UI é uma referência local da demonstração, não uma confirmação de ingestão: ao receber leituras reais do Eventhouse, a UI assume o estado recebido; dados ausentes ou desatualizados continuam sendo tratados como sem comunicação.

O painel do ativo mostra **Operação (telemetria)** somente como **Em funcionamento** ou **Parado**; o assistente recebe o mesmo booleano. Uma alteração na UI é confirmada nesse indicador quando chega a telemetria correspondente. Problemas reais de conexão continuam indicados separadamente e não criam um terceiro valor de `isRunning`: enquanto não há nova leitura, a UI mantém o último estado operacional conhecido. Um equipamento parado continua enviando `isRunning=false`.

Exemplo de evento de uma empilhadeira parada:

```json
{
  "eventType": "telemetry",
  "machineId": "FKL-001",
  "ts": "2026-10-26T19:35:00.000Z",
  "temp": 46.2,
  "vib": 0.18,
  "usage": 12,
  "mode": "off",
  "speed": 0,
  "isRunning": false
}
```

O horário acima é ilustrativo; o simulador envia o horário atual em UTC. Use booleanos JSON `true`/`false`, sem aspas.

Se você optou por armazenar `isRunning` como `string` no Eventhouse, o proxy normaliza a leitura com `tobool(isRunning)` para entregar booleanos à UI. Os valores textuais `"true"`/`"false"` são aceitos. Para simplificar a demo ao consultar registros antigos sem um booleano válido, o proxy calcula o estado por `mode` e `speed`; sem esses dados, considera parado (`false`). Isso é uma convenção da demonstração, não confirmação física de operação. O produtor continua enviando booleanos JSON, e o schema recomendado neste guia permanece `bool`.

| Endpoint local | Função |
|---|---|
| `POST /api/params` | Atualiza os parâmetros desejados no proxy. |
| `POST /api/commands` | Aplica o comando ao estado desejado no proxy. |
| `GET /api/devices/control` | Entrega o estado desejado ao simulador. |
| `GET /api/telemetry/stream` | Entrega à SPA a telemetria consultada no Eventhouse via SSE. |

O simulador consulta o controle antes de cada envio, sem depender da latência de ingestão do Eventhouse. A confirmação `ack: true, delivery: local-control` significa **controle aceito em memória**, não execução física nem persistência no Fabric. O proxy perde esse estado ao reiniciar. Sem acesso ao proxy, o simulador registra `[control]` e continua com o último estado conhecido; isso não é um mecanismo de segurança industrial.

Esse canal HTTP é para demonstração local, sem autenticação. Para equipamentos reais, substitua-o por uma integração de controle apropriada, com autenticação, confirmação de execução e mecanismos de segurança. A telemetria registra o estado observado, não constitui uma auditoria completa de todas as ações.

### Configuração mínima

```env
VITE_TELEMETRY_MODE=fabric
API_PORT=8787
FABRIC_EVENTSTREAM_CONNECTION_STRING="Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=...;EntityPath=..."
FABRIC_EVENTSTREAM_NAME=
FABRIC_KUSTO_URI=https://<query-uri-copiada-do-portal>
FABRIC_KUSTO_DATABASE=IoTFactory
FABRIC_KUSTO_SCOPE=https://kusto.kusto.windows.net/.default
FABRIC_TELEMETRY_TABLE=MachineTelemetry
FABRIC_POLL_MS=3000
FABRIC_STALE_SEC=15
FABRIC_LOOPBACK=false
DEVICE_INTERVAL_MS=2000
DEVICE_CONTROL_URL=http://localhost:8787
```

| Variável | Origem ou efeito |
|---|---|
| `FABRIC_EVENTSTREAM_CONNECTION_STRING` | Fonte Custom endpoint, connection string Event Hubs completa. |
| `FABRIC_EVENTSTREAM_NAME` | Nome do Event Hub; deixe vazio quando a string já contém `EntityPath`. |
| `FABRIC_KUSTO_URI` | **Query URI** do banco KQL; não use Ingestion URI. |
| `FABRIC_KUSTO_DATABASE` | Nome do banco, por exemplo `IoTFactory`. |
| `FABRIC_TELEMETRY_TABLE` | Nome da tabela consultada; não cria nem configura o destino de ingestão. |
| `FABRIC_KUSTO_SCOPE` | Escopo Entra ID; padrão `https://kusto.kusto.windows.net/.default`. |
| `FABRIC_POLL_MS` | Intervalo de consulta do proxy. |
| `FABRIC_STALE_SEC` | Idade máxima da leitura antes de aparecer sem comunicação; padrão 15 segundos. |
| `DEVICE_INTERVAL_MS` | Pausa entre ciclos do simulador; padrão 2000 ms. Consultas e envios acrescentam tempo ao ciclo. |
| `DEVICE_CONTROL_URL` | URL base do proxy; se omitida, usa `http://localhost:<API_PORT>`, com porta padrão 8787. |

### Configurar e obter a ingestão em tempo real (Real-Time Intelligence)

Os nomes dos botões abaixo estão em inglês e podem variar conforme a versão e o idioma do portal.

**1. Criar o Eventhouse, banco e tabela**

No [portal do Fabric](https://app.fabric.microsoft.com), abra um workspace com capacidade Fabric ou Trial e permissão Contributor ou superior. Crie um **Eventhouse** e um banco KQL, por exemplo `IoTFactory`. Abra o banco e, se a tabela ainda não existir, execute:

```kusto
.create table MachineTelemetry (eventType:string, machineId:string, ts:datetime, temp:real, vib:real, usage:int, mode:string, speed:int, isRunning:bool)
```

Se a tabela já existir sem `isRunning`, execute no banco KQL o comando abaixo para adicionar a coluna sem apagar dados:

```kusto
.alter-merge table MachineTelemetry (isRunning:bool)
```

Não recrie a tabela. Registros antigos continuam sem valor nessa coluna; o comando não preenche o histórico. Atualize também o schema/mapeamento do Eventstream conforme a etapa 6 e publique as alterações.

**2. Criar a fonte do Eventstream e copiar a connection string**

1. No workspace, crie ou abra o **Eventstream**.
2. Em **Edit**, selecione **Add source → Custom endpoint**, nomeie a fonte e selecione **Publish**.
3. Em **Live view**, selecione a fonte e abra **Details → Event Hub → SAS Key Authentication**.
4. Copie **Connection string-primary key** ou a secundária inteira para `FABRIC_EVENTSTREAM_CONNECTION_STRING`. Não copie somente a chave, nem as configurações Kafka.
5. Se a string já incluir `EntityPath`, deixe `FABRIC_EVENTSTREAM_NAME` vazio; caso contrário, preencha com **Event hub name**.

Guarde a string SAS somente no `.env` ou em um gerenciador de segredos.

**3. Configurar a consulta do Eventhouse**

1. Abra o **banco KQL** do Eventhouse e copie **Query URI** dos detalhes para `FABRIC_KUSTO_URI`. Não construa a URI a partir do nome do recurso.
2. Preencha `FABRIC_KUSTO_DATABASE` e `FABRIC_TELEMETRY_TABLE`.
3. Execute `az login` com a identidade que tem permissão de consulta, como Viewer no banco ou equivalente. A chave SAS de publicação não concede acesso às consultas.

O projeto chama `/v1/rest/query` usando `DefaultAzureCredential`. A **Ingestion URI** não deve ser colocada em `FABRIC_KUSTO_URI`.

**4. Conferir a entrada de eventos**

1. Inicie `npm run dev:all` em um terminal e `npm run simulate:devices` em outro, na raiz.
2. No Eventstream, abra **Live view**, selecione a fonte ou stream principal e abra **Data preview**.
3. Atualize e confira os campos `eventType`, `machineId`, `ts`, `temp`, `vib`, `usage`, `mode`, `speed` e `isRunning`, na raiz do JSON. Se `isRunning` não aparecer, reinicie o simulador com o código atualizado.
4. Confirme `eventType=telemetry`. Se não houver eventos, confira os logs do simulador, a connection string e se a fonte está publicada antes de investigar o destino.

Após o primeiro lote enviado com sucesso, o simulador imprime uma única amostra JSON com o prefixo `[telemetry] Exemplo de payload aceito pelo endpoint:`. Confira nesse JSON o campo exato `isRunning` (com `R` maiúsculo), booleano e na raiz do evento. Esse log confirma aceitação pelo endpoint de envio, não persistência no Eventhouse.

Se o terminal mostrar o campo, mas a prévia do Fabric não, atualize a amostra/schema da fonte ou do stream e confira se você está olhando a fonte correta. Se o campo aparecer na fonte e desaparecer depois, confira a saída do filtro, operadores **Manage fields** e o mapeamento do destino. Não use `isrunning`: os nomes precisam corresponder exatamente. Reinicie o simulador para obter uma nova amostra no terminal após alterações de código.

**5. Criar um filtro de telemetria**

1. Selecione **Edit**.
2. A partir do stream principal, selecione **Transform events → Filter**, ou use **+ → Filter** no nó.
3. Nomeie o filtro `FilterTelemetry`.
4. Selecione o campo `eventType`, operador de igualdade (**Equals** ou `=`), tipo **String** se solicitado, e valor `telemetry`. No campo de valor da interface, não acrescente aspas.
5. Salve e confira a conexão do stream principal à entrada do filtro.

Se `eventType` não aparecer na seleção, confira o schema do nó anterior e atualize a prévia com eventos reais. O filtro usa o campo do corpo JSON, não apenas propriedades de transporte do Event Hubs.

```text
Custom endpoint -> Stream principal -> FilterTelemetry -> MachineTelemetry
                                      eventType=telemetry
```

O filtro mantém fora da tabela eventuais eventos legados ou de outros produtores. Para este fluxo com filtro, use processamento antes da ingestão na próxima etapa.

**6. Adicionar o destino Eventhouse**

1. Na saída de `FilterTelemetry`, selecione **+ → Eventhouse**.
2. Selecione **Event processing before ingestion**, normalmente já selecionado após um operador.
3. Preencha o nome, por exemplo `ToMachineTelemetry`.
4. Selecione o **Workspace**, o **Eventhouse**, o banco KQL **IoTFactory** e a tabela existente **MachineTelemetry**, nos campos apresentados pelo portal. Confira o banco se houver mais de um.
5. Se aparecer **Activate ingestion**, deixe ativado.
6. Confira schema/mapeamento e selecione **Save**.

| Tipo KQL | Campos |
|---|---|
| `string` | `eventType`, `machineId`, `mode` |
| `datetime` | `ts` |
| `real` | `temp`, `vib` |
| `int` | `usage`, `speed` |
| `bool` | `isRunning` |

Preserve os nomes e a capitalização. Se usar **Manage fields**, mantenha os nove campos. Se abrir um assistente de inspeção, escolha **JSON** e confira **Edit columns**. Quando forem solicitados caminhos JSON, use `$.eventType`, `$.machineId`, `$.ts`, `$.temp`, `$.vib`, `$.usage`, `$.mode`, `$.speed` e `$.isRunning`, não `$.body.temp`.

Em um fluxo já existente, atualize o schema de entrada com uma nova amostra, preserve `isRunning` nos operadores e inclua a coluna booleana no destino. Adicionar a coluna no Eventhouse não atualiza automaticamente o schema ou o mapeamento do Eventstream. Se o campo existir na prévia da fonte mas chegar nulo à tabela, confira cada operador e o mapeamento `$.isRunning`, salve e publique.

O `ts` é enviado como ISO 8601 em UTC e deve chegar como `datetime`. Algumas versões apresentam o schema diretamente, sem assistente separado.

**7. Publicar e ativar**

1. Confira **Test result** ou a prévia do filtro.
2. Resolva erros em **Authoring errors**.
3. Selecione **Publish**: salvar o destino não publica o fluxo.
4. Na **Live view**, confira fonte e destino ativos, sem erros; retome o destino se estiver pausado.
5. Envie novos eventos depois de o fluxo estar ativo. Não conte com reprocessamento automático das amostras anteriores. Para recuperar eventos anteriores, confira retomada por **Custom time** e retenção disponível.

**8. Confirmar persistência e efeito de um comando**

Mantenha os dois processos em execução:

```powershell
# Terminal 1: SPA e proxy
npm run dev:all

# Terminal 2: simulador com controle HTTP e envio real ao Fabric
npm run simulate:devices
```

`npm run dev:all` não inicia o simulador. Em <http://localhost:5173>, selecione uma empilhadeira da demonstração e aplique a parada. A UI reflete a ação; no próximo ciclo com controle disponível o simulador aplica `mode=off`, `speed=0`, `isRunning=false` e publica esse estado como telemetria.

No banco KQL, execute:

```kusto
MachineTelemetry
| where ts > ago(10m)
| extend ingestedAt = ingestion_time()
| project machineId, ts, ingestedAt, isRunning, mode, speed, temp, vib, usage
| top 30 by ts desc
```

Para acompanhar somente a empilhadeira escolhida:

```kusto
MachineTelemetry
| where ts > ago(10m) and machineId == "FKL-001"
| project ts, isRunning, mode, speed, temp, vib, usage
| order by ts desc
| take 20
```

Substitua o ID se necessário. Confira eventos posteriores à ação com `isRunning=false`, `mode=off` e `speed=0`. Ao executar `RESUME`, espere `isRunning=true` nos novos eventos. A chegada à UI pelo Fabric tem o atraso de ingestão mais o polling; não é controle instantâneo pelo Eventhouse.

Para ver o último estado por máquina, sem confundir registros antigos com o estado atual:

```kusto
MachineTelemetry
| where ts > ago(10m)
| summarize arg_max(ts, *) by machineId
| extend isRunning = coalesce(
    tobool(isRunning),
    coalesce(mode !in ("off", "paused") and speed > 0, false))
| extend Operacao = iff(isRunning, "Em funcionamento", "Parado"),
    Comunicacao = iff(ts > ago(15s), "Recente", "Sem leitura recente")
| project machineId, ts, isRunning, Operacao, Comunicacao, mode, speed
| order by machineId asc
```

O limite de 15 segundos corresponde ao padrão de `FABRIC_STALE_SEC`; ajuste a consulta se mudar essa configuração. Máquinas sem eventos nos últimos 10 minutos não aparecem nessa consulta, o que não significa que estejam paradas.

Uma conferência inicial da tabela, inclusive se estiver vazia:

```kusto
MachineTelemetry
| summarize Total=count(), UltimoEvento=max(ts),
    UltimaIngestao=max(ingestion_time()),
    TipoIncorreto=countif(isempty(eventType) or eventType != "telemetry")
```

O total deve aumentar, e `TipoIncorreto` deve ser zero para os novos dados. Essa consulta sem janela é para diagnóstico inicial; em tabelas grandes, filtre por tempo no monitoramento frequente. `ingestion_time()` é aproximado e pode ser nulo se a política de horário de ingestão não estiver habilitada.

**9. Migrar uma configuração anterior com múltiplas tabelas**

1. Atualize e reinicie proxy e simulador. Não misture o simulador antigo com o proxy novo.
2. No editor do Eventstream, desative/remova os filtros e destinos antigos de parâmetros e comandos. Mantenha somente a ramificação de telemetria e publique.
3. Mantenha os dados das tabelas antigas se houver histórico útil; a aplicação não depende delas nem as apaga.
4. Remova do `.env`, se existir, a antiga variável `FABRIC_PARAMS_TABLE`: ela não é mais utilizada.
5. Se a tabela ainda não tiver o estado operacional, execute `.alter-merge table MachineTelemetry (isRunning:bool)` e atualize o schema/mapeamento do Eventstream para incluir `$.isRunning` como booleano. Publique e confirme o campo em novos eventos; não é necessário apagar o histórico.

**10. Diagnosticar falhas**

| Sintoma | O que conferir |
|---|---|
| Não há eventos na fonte | Simulador, logs de envio, connection string e publicação da fonte. |
| A fonte recebe, mas o filtro não produz saída | Campo JSON `eventType`, valor exato `telemetry`, schema e conexão do filtro. |
| O filtro produz saída, mas a tabela está vazia | Workspace/banco/tabela do destino, permissões de escrita, schema, publicação, ativação e erros do destino. |
| A ação muda a UI, mas não a telemetria do simulador | Proxy atualizado, simulador em execução, `DEVICE_CONTROL_URL`, porta e erros `[control]`. |
| Há campos vazios | Nomes, tipos, caminhos JSON e campos preservados após transformações. |
| Há dados no KQL, mas a UI indica perda de comunicação | Horários atuais, tabela/banco do proxy e IDs em `app/src/shared/machines.js`. |

O proxy consulta os últimos 10 minutos. As 16 máquinas transmitem desde o início; o `ROB-003` começa parado e `RESUME` ou `CYCLE_START` coloca-o em funcionamento com velocidade 100. Ajustar `FABRIC_STALE_SEC` muda a tolerância da UI, mas não acelera a ingestão.

`GET /api/health` com indicadores `true` verifica presença de configuração, não credenciais nem chegada de dados. Status conectado significa conexão com o proxy. O ACK de controle não comprova execução; confirme o estado na telemetria. A aplicação ainda não oferece confirmação individual por `eventId`.

Referências oficiais: [Custom endpoint](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/event-streams/add-source-custom-app), [destino Eventhouse](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/event-streams/add-destination-kql-database) e [editor de processamento](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/event-streams/process-events-using-event-processor-editor).

### Testar sem Fabric (loopback)

Deixe connection string, `FABRIC_KUSTO_URI` e `FABRIC_KUSTO_DATABASE` vazios e configure:

```env
VITE_TELEMETRY_MODE=fabric
FABRIC_LOOPBACK=true
```

Execute somente `npm run dev:all`. O proxy aplica controle e simula telemetria em memória; não precisa do simulador separado e não envia dados ao Fabric.

## Agente Foundry

Crie um agente de prompt no projeto Foundry e anote o **nome** do agente. Conceda à identidade do proxy o papel **Azure AI User** no projeto.

```env
VITE_AGENT_MODE=foundry
FOUNDRY_PROJECT_ENDPOINT=https://<recurso>.services.ai.azure.com/api/projects/<projeto>
FOUNDRY_AGENT_NAME=<nome-do-agente>
FOUNDRY_API_VERSION=v1
FOUNDRY_SCOPE=https://ai.azure.com/.default
FOUNDRY_DEBUG=false
```

| Variável | Origem ou efeito |
|---|---|
| `FOUNDRY_PROJECT_ENDPOINT` | Endpoint da API do projeto, sem barra no final. |
| `FOUNDRY_AGENT_NAME` | Nome do agente na UI atual, não o ID clássico `asst_...`. |
| `FOUNDRY_API_VERSION` | Padrão `v1`, salvo exigência do projeto. |
| `FOUNDRY_SCOPE` | Padrão `https://ai.azure.com/.default`. |
| `FOUNDRY_DEBUG` | `true` registra mensagens, payloads e respostas; pode expor conversas nos logs. |
| `VITE_AGENT_DEBUG` | Log no navegador; vazio mantém ligado em desenvolvimento. |

Para compatibilidade com o agente clássico, use `FOUNDRY_AGENT_ID=asst_...` somente sem `FOUNDRY_AGENT_NAME`.

## Os dois juntos

Combine os blocos de configuração do Fabric e Foundry no mesmo `.env`, com `VITE_TELEMETRY_MODE=fabric` e `VITE_AGENT_MODE=foundry`. Inicie SPA e proxy com `npm run dev:all` ou `.\dev.ps1 start`, e o simulador em outro terminal com `npm run simulate:devices`.

Abra <http://localhost:5173>. Confira a telemetria em **Sincronização Fabric RTI** e abra **Assistente IoT** para enviar uma mensagem. Falhas do agente aparecem no chat e no console do proxy.
