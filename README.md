# AI Fabric — Dashboard IoT de chão de fábrica

SPA de monitoramento de 16 máquinas industriais com cena 3D interativa, telemetria reativa e integrações opcionais com Microsoft Fabric Real-Time Intelligence (RTI) e Microsoft Foundry. A interface é feita em JavaScript modular, sem framework, com Vite e Three.js.

> **Demonstração:** os dados iniciais, a identificação do operador e as informações de sessão são fictícios. A interface não implementa autenticação. Use a integração Fabric para conectar telemetria real.

## Requisitos

- Node.js 24 ou superior e npm.
- Para integrações reais: recursos e permissões configurados no Microsoft Fabric e/ou Microsoft Foundry, conforme necessário.

## Executar localmente

Na raiz do projeto:

```bash
npm install
npm run dev
```

Abra <http://localhost:5173>. Por padrão, a telemetria e o assistente usam implementações mock locais; esse modo não exige o proxy.

Para iniciar a SPA e o proxy Express juntos:

```bash
npm run dev:all
```

No Windows, também é possível gerenciar os dois processos pelo PowerShell:

```powershell
.\dev.ps1 start
.\dev.ps1 status
.\dev.ps1 stop
.\dev.ps1 restart
```

O script abre um console com os logs ao vivo e grava uma cópia em `.dev-processes\stdout.log`. Se a política local bloquear scripts, execute `powershell -NoProfile -ExecutionPolicy Bypass -File .\dev.ps1 start`. Para interromper a execução manual de `npm run dev:all`, use `Ctrl+C`.

## O que a SPA oferece

- **Cena 3D:** galpão industrial, máquinas animadas, câmera orbital, seleção de ativos e modo vitrine.
- **Monitoramento reativo:** lista de máquinas, estados online/alerta/offline, métricas, alertas, KPIs, eventos e sincronização.
- **Painel do ativo:** temperatura, vibração, utilização, limites e setpoints.
- **Ajuste de parâmetros:** pré-visualização imediata na interface, validação por tipo de máquina, restauração dos valores padrão e aplicação ou cancelamento.
- **Comandos:** `EMERGENCY_STOP`, `PAUSE`, `RESUME`, `CALIBRATE`, `SPEED_UP`, `SLOW_DOWN` e `CYCLE_START`. A parada de emergência pede confirmação.
- **Assistente IoT:** no modo mock, responde com uma base local sobre máquinas, estado e manutenção; no modo Foundry, conversa com o agente configurado e recebe o contexto ao vivo da planta enviado pelo proxy.
- **Telemetria:** simulador local no navegador ou leitura do Fabric Eventhouse via proxy. Somente telemetria vai ao Fabric; comandos e ajustes usam o controle HTTP local do simulador.
- **Estado operacional:** `isRunning=true` indica em funcionamento; `false` indica parado (desligado, pausado ou velocidade zero). O painel mostra esse estado recebido por telemetria separadamente de perda de comunicação.

Os valores de temperatura, vibração, utilização, KPIs e estado inicial são demonstrações; não representam uma instalação ou processo industrial real.

Os [manuais fictícios de operação](Manuais/README.md) descrevem os parâmetros de configuração dos 16 equipamentos, com valores sugeridos para demonstração, um alerta comum de temperatura e a ação correspondente. Não devem ser usados para operar máquinas reais.

UI e simuladores compartilham o estado operacional inicial: 15 máquinas começam em funcionamento (`isRunning=true`), e `ROB-003` começa parado (`isRunning=false`, modo `off`, velocidade zero). Todas as 16 enviam telemetria, sempre com estado booleano, sem `null`. O primeiro lote preserva os valores iniciais antes da evolução física; alertas de temperatura/vibração não significam equipamento parado. Para uma demonstração limpa, reinicie proxy e simulador e recarregue a SPA. Controles já existentes no proxy são respeitados.

## Modos de execução

| Configuração | Comportamento |
|---|---|
| `VITE_TELEMETRY_MODE=mock` | Simulação local no navegador; padrão. |
| `VITE_TELEMETRY_MODE=fabric` | Recebe telemetria do proxy por Server-Sent Events (SSE), consultada no Eventhouse. |
| `VITE_AGENT_MODE=mock` | Assistente local com base de conhecimento e contexto da planta; padrão. |
| `VITE_AGENT_MODE=foundry` | Usa o agente Microsoft Foundry através do proxy; o estado da planta é anexado à pergunta. |
| `FABRIC_LOOPBACK=true` | Emula a API de telemetria, parâmetros e comandos em memória para testar o adaptador `fabric` sem Fabric. |

`npm run dev` inicia apenas o Vite. Para os modos `fabric` e `foundry`, inicie também o proxy com `npm run dev:all` ou `npm run server`.

## Configuração

O passo a passo curto do Eventstream, do Eventhouse e do agente Foundry, com o `.env` mínimo de cada um, está em [docs/setup-fabric-foundry.md](docs/setup-fabric-foundry.md).

Copie `.env.example` para `.env` e preencha somente as configurações dos serviços que pretende usar. O arquivo `.env` não deve ser versionado. O Vite carrega as variáveis de front-end a partir da raiz do projeto; credenciais do Fabric e Foundry são usadas apenas pelo proxy.

| Variável | Finalidade |
|---|---|
| `VITE_TELEMETRY_MODE` | `mock` ou `fabric`. |
| `VITE_AGENT_MODE` | `mock` ou `foundry`. |
| `VITE_AGENT_DEBUG` | Força `true`/`false` para logs do agente no console do navegador; por padrão, os logs ficam ativos em desenvolvimento. |
| `VITE_API_BASE` | Prefixo opcional da API; normalmente vazio, pois o Vite encaminha `/api` ao proxy. |
| `API_PORT` | Porta do proxy Express; padrão `8787`. |
| `FABRIC_EVENTSTREAM_CONNECTION_STRING` | Connection string do endpoint Event Hubs do Eventstream; usada somente para publicar telemetria. |
| `FABRIC_EVENTSTREAM_NAME` | Nome do Event Hub, se não estiver incluído na connection string. |
| `FABRIC_KUSTO_URI`, `FABRIC_KUSTO_DATABASE` | URI de consulta e banco KQL do Eventhouse. |
| `FABRIC_KUSTO_SCOPE` | Escopo Entra ID do Eventhouse; padrão `https://kusto.kusto.windows.net/.default`. |
| `FABRIC_TELEMETRY_TABLE` | Tabela KQL de telemetria; padrão `MachineTelemetry`. |
| `FABRIC_POLL_MS`, `FABRIC_STALE_SEC` | Intervalo de consulta e limite de telemetria considerada desatualizada. |
| `FABRIC_LOOPBACK` | `true` ativa a emulação em memória do proxy, quando o Eventhouse não está configurado. |
| `DEVICE_INTERVAL_MS` | Intervalo do simulador de dispositivos; padrão `2000` ms. |
| `DEVICE_CONTROL_URL` | URL base do proxy consultado pelo simulador; padrão `http://localhost:<API_PORT>`. |
| `FOUNDRY_PROJECT_ENDPOINT`, `FOUNDRY_AGENT_NAME` | Endpoint do projeto Foundry e nome do agente. |
| `FOUNDRY_AGENT_ID` | Compatibilidade com o Agent Service clássico; IDs `asst_...` usam o endpoint legado quando `FOUNDRY_AGENT_NAME` não está definido. |
| `FOUNDRY_API_VERSION`, `FOUNDRY_SCOPE`, `FOUNDRY_TIMEOUT_MS` | Versão da API, escopo Entra ID e timeout do agente. |
| `FOUNDRY_DEBUG` | `true` registra mensagens, payload e respostas do agente no console do proxy. Pode expor conteúdo de conversas nos logs. |

O proxy autentica no Fabric e no Foundry com `DefaultAzureCredential` (por exemplo, `az login` durante desenvolvimento ou managed identity em hospedagem). Não coloque credenciais em variáveis `VITE_*`, pois elas podem ser incluídas no bundle do navegador.

## Fabric Real-Time Intelligence

Para configurar a ingestão, localizar a connection string do Eventstream e a Query URI do Eventhouse, e verificar a chegada dos dados, veja [Ingestão em tempo real: passo a passo](docs/setup-fabric-foundry.md#configurar-e-obter-a-ingestão-em-tempo-real-real-time-intelligence).

### Eventhouse

O [de-para de equipamentos](docs/de-para-equipamentos.csv) contém os 16 códigos, descrições e tipos cadastrados em `app/src/shared/machines.js`, em CSV UTF-8. Use `machineId` para relacioná-lo à telemetria de `MachineTelemetry` e fornecer contexto ao Data Agent. É um cadastro estático de demonstração, não um registro de leituras ou estados atuais; atualize-o quando o cadastro de máquinas mudar.

Crie um banco KQL e a única tabela usada pela integração:

```kusto
.create table MachineTelemetry (eventType:string, machineId:string, ts:datetime, temp:real, vib:real, usage:int, mode:string, speed:int, isRunning:bool)
```

Para uma tabela existente, adicione a coluna sem apagar dados:

```kusto
.alter-merge table MachineTelemetry (isRunning:bool)
```

Atualize também o schema/mapeamento do Eventstream para preservar `isRunning` e mapear `$.isRunning` como booleano; depois publique. Registros antigos permanecem sem essa informação, não equivalem a equipamento parado. O [guia de setup](docs/setup-fabric-foundry.md#equipamento-parado-ou-em-funcionamento) descreve o campo e as consultas de conferência.

Configure `FABRIC_KUSTO_URI` e `FABRIC_KUSTO_DATABASE`. Conceda à identidade usada pelo proxy permissão para consultar o banco.

### Eventstream e simulador

1. Crie um Eventstream com uma fonte **Custom endpoint** usando o protocolo Event Hubs e configure `FABRIC_EVENTSTREAM_CONNECTION_STRING` (e, se necessário, `FABRIC_EVENTSTREAM_NAME`).
2. Configure um único destino no Eventhouse: `telemetry` para `MachineTelemetry`.
3. Conceda à identidade de desenvolvimento permissão para enviar eventos ao Eventstream e consultar o Eventhouse.
4. Defina `VITE_TELEMETRY_MODE=fabric` e inicie `npm run dev:all`.
5. Execute `npm run simulate:devices` em outro terminal para enviar telemetria dos 16 dispositivos, incluindo o `ROB-003` parado. O simulador busca o controle desejado no proxy HTTP, aplica comandos e ajustes e publica o estado resultante (`isRunning`, `mode`, `speed`, temperatura, vibração e utilização).

O controle segue `UI → proxy HTTP → simulador`; a telemetria segue `simulador → Eventstream → MachineTelemetry → proxy → UI`. O ACK da API confirma controle aceito em memória, não execução no dispositivo nem ingestão no Fabric. O estado desejado é volátil: reiniciar o proxy restaura os padrões. Se o proxy estiver indisponível, o simulador registra o erro e continua enviando o último estado conhecido. Esse canal é exclusivo da demonstração local, sem autenticação; equipamentos reais exigem uma integração de controle apropriada.

Configurações antigas: desative/remova no portal os filtros e destinos de parâmetros e comandos e publique o fluxo. As tabelas antigas podem permanecer para preservar o histórico, mas não são mais usadas. A antiga variável de tabela de parâmetros é ignorada. Em `MachineTelemetry`, acrescente `isRunning:bool` conforme descrito acima.

O proxy consulta a última leitura por máquina e a transmite à SPA via SSE. Leituras mais antigas que `FABRIC_STALE_SEC` (15 segundos por padrão), ou máquinas sem leitura, são mostradas como sem comunicação.

Para testar o caminho do adaptador `fabric` sem recursos Fabric, defina `FABRIC_LOOPBACK=true` e `VITE_TELEMETRY_MODE=fabric`, depois inicie `npm run dev:all`. O loopback emula as operações em memória; não envia dados ao Fabric.

## Microsoft Foundry

1. Crie um agente de prompt em um projeto do Foundry e defina as instruções desejadas.
2. Conceda à identidade do proxy o papel necessário para usar o projeto (por exemplo, **Azure AI User**).
3. Configure `FOUNDRY_PROJECT_ENDPOINT` e `FOUNDRY_AGENT_NAME` no `.env`.
4. Defina `VITE_AGENT_MODE=foundry` e inicie `npm run dev:all`.

A SPA envia a mensagem, um snapshot da planta (contagens, alertas, ativos e máquina selecionada) e o ID da conversa ao proxy. O proxy acrescenta esse contexto à pergunta e chama o Foundry; as credenciais não são expostas ao navegador. Para iniciar uma conversa nova, use o botão **Nova conversa** no assistente. Evite `FOUNDRY_DEBUG=true` fora de ambientes apropriados: esse modo registra o conteúdo das mensagens e das respostas.

## Build, produção e testes

```bash
npm run build
npm run preview
```

O build da SPA é gerado em `dist/`. Para servir a versão buildada com a API, configure o `.env` e execute `npm run server`; o Express serve `dist/` quando a pasta existe. O `npm run preview` do Vite serve apenas o front-end e não inicia a API.

Testes de controle local, telemetria Fabric e regressão do assistente (Node 24):

```bash
node --experimental-test-module-mocks --test tests\agent.test.js tests\device-control.test.js tests\fabric.test.js tests\telemetry-state.test.js
```

Os testes isolam o Azure; os testes de controle usam um servidor HTTP local em porta temporária.

## Estrutura do projeto

```text
.env.example                 Modelo das variáveis; copie para .env na raiz
docs/setup-fabric-foundry.md Setup do Eventstream, Eventhouse e agente Foundry
app/
  index.html                  Entrada da SPA (http://localhost:5173)
  src/main.js                 Lê VITE_TELEMETRY_MODE e VITE_AGENT_MODE
  src/shared/                 Modelo, regras de status e simulação
  src/scene/                  Cena 3D Three.js
  src/ui/                     Painéis, modal de parâmetros e assistente
  src/integration/            Adaptadores telemetry (mock|fabric) e agent (mock|foundry)
server/
  index.js                    API Express em API_PORT (padrão 8787)
  fabric.js                   Cliente Eventstream/Eventhouse (FABRIC_*)
  foundry.js                  Cliente Microsoft Foundry (FOUNDRY_*)
  deviceSimulator.js          Simulador de dispositivos para o Eventstream
  deviceControl.js            Controle HTTP local dos dispositivos simulados
tests/
  agent.test.js               Testes do adaptador do assistente
  device-control.test.js      Controle HTTP e aplicação no simulador
  fabric.test.js              Publicação exclusiva de telemetria e consultas
  telemetry-state.test.js     Estado da UI e efeitos dos comandos
```
