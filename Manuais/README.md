# Manuais ficticios de operacao

Material curto para demonstracao do Dashboard IoT. **Nao utilizar estes valores ou procedimentos em equipamentos reais.** Operacao real exige manual do fabricante, avaliacao de riscos e pessoal habilitado.

## Equipamentos

| Codigo | Manual |
|---|---|
| CNC-001 | [Torno CNC 1](CNC-001.md) |
| CNC-002 | [Torno CNC 2](CNC-002.md) |
| CNC-003 | [Fresa CNC 1](CNC-003.md) |
| ROB-001 | [Braco Robo A](ROB-001.md) |
| ROB-002 | [Braco Robo B](ROB-002.md) |
| ROB-003 | [Braco Robo C](ROB-003.md) |
| CVY-001 | [Esteira 1](CVY-001.md) |
| CVY-002 | [Esteira 2](CVY-002.md) |
| CVY-003 | [Esteira 3](CVY-003.md) |
| FKL-001 | [Empilhadeira 1](FKL-001.md) |
| FKL-002 | [Empilhadeira 2](FKL-002.md) |
| FKL-003 | [Empilhadeira 3](FKL-003.md) |
| INJ-001 | [Injetora 1](INJ-001.md) |
| INJ-002 | [Injetora 2](INJ-002.md) |
| PRE-001 | [Prensa Hidraulica](PRE-001.md) |
| WLD-001 | [Solda Robotica](WLD-001.md) |

## Como interpretar a configuracao

Os valores sugeridos seguem os campos de `app/src/shared/machines.js`; nao alteram o cadastro nem representam telemetria atual. CNC-003, FKL-003 e INJ-002 recebem alvos ficticios menores que seus limites de alarme, pois seus alvos originais ja excedem esses limites.

| Campo | Significado e faixa aceita pelo dashboard |
|---|---|
| `mode` | `auto`: automatico; `manual`: manual; `paused`: pausado; `off`: desligado. Sao modos do simulador, nao autorizacoes de seguranca. |
| `speed` | Percentual da velocidade de referencia, de 0 a 130%, com passo de 5%. Nao equivale a rpm ou km/h; zero representa parada no simulador. |
| `targetTemp` | Alvo de temperatura: 20 a 120 graus C; injetoras: 150 a 260; solda: 200 a 450. |
| `tempLimit` | Limite de alarme: 30 a 140 graus C; injetoras: 160 a 280; solda: 250 a 500. Deve ser maior que `targetTemp`. |
| `vibLimit` | Limite de vibracao de 0,2 a 4,0 mm/s, com passo de 0,1 mm/s. |
| `cycleTime` | Tempo de ciclo de 2 a 120 s; empilhadeiras aceitam ate 300 s. |

## Aplicacao no ambiente de demonstracao

Selecione o codigo correto, abra o ajuste de parametros, confira os valores e use **Aplicar**. A pre-visualizacao pode mudar o painel antes da confirmacao; **Cancelar** descarta o ajuste. Confirmacao da API nao comprova execucao: confira a telemetria posterior. O controle e local ao simulador; nao e enviado ao Fabric.

## Alerta comum: temperatura elevada

Com comunicacao disponivel e modo diferente de `off`, o dashboard alerta quando `temp >= tempLimit`; a severidade e critica quando `temp >= tempLimit * 1,05`. Cada manual informa o limite do equipamento.

Na demonstracao, pause o ciclo, registre codigo, leitura e limite e acompanhe a telemetria. Nao aumente o limite para esconder o alerta. Retome apenas apos normalizacao das leituras e liberacao do responsavel pela demonstracao. As causas sugeridas nos manuais sao hipoteses ficticias, nao diagnosticos.

Vibracao alerta quando `vib >= vibLimit`. `paused` tambem gera alerta; isso nao significa nova falha. Perda de comunicacao ou modo `off` tem prioridade e resulta em `offline`, sem avaliar os demais alertas. `Offline` nao comprova desligamento fisico, e `online` nao garante seguranca.
