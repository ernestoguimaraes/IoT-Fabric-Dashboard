# 🏭 IoT Factory Dashboard — 3D Monitoramento de Chão de Fábrica

Dashboard 3D interativo para monitoramento IoT de máquinas em um chão de fábrica, construído com Three.js.

## 🚀 Como usar

Abra o arquivo `index.html` em qualquer navegador moderno:

```bash
# Windows
start index.html

# Ou simplesmente dê duplo clique no arquivo
```

**Navegação:** Arraste para orbitar, scroll para zoom.

### 🛡️ Proposta visual — Escolta armada (`index-escolta-armada.html`)

Abra [index-escolta-armada.html](index-escolta-armada.html) no navegador para visualizar a proposta de monitoramento de veículos e equipes em deslocamento. A página preserva a identidade do projeto: fundo escuro, azul GPS, cartões de indicadores, painéis laterais e barra de status. As versões industriais permanecem inalteradas.

- **Visão central:** mapa vetorial em perspectiva, percurso ilustrativo, veículos selecionáveis e progresso da jornada.
- **Animação:** comboio com dois veículos de escolta e um caminhão percorre a rota em loop, com faróis, rastro luminoso, fluxo de luz e pulso de localização no veículo selecionado. As posições animadas são ilustrativas e independentes dos indicadores fixos.
- **Painel esquerdo:** operação, origem/destino, veículos e check-in das equipes.
- **Painel direito:** telemetria do veículo selecionado, alerta de bateria e histórico.
- **Interações:** selecione veículos na lista ou no mapa; simule a ciência do alerta para atualizar o contador e o histórico sem remover a condição de bateria baixa.
- **Responsivo:** os painéis são empilhados em telas menores; seleção e botões também funcionam pelo teclado.
- **Controle de movimento:** botão para pausar/reproduzir; apontar para um marcador ou focá-lo pelo teclado pausa o movimento para facilitar a seleção. A animação inicia pausada quando o sistema solicita movimento reduzido e é suspensa enquanto a aba está oculta.

Todos os indicadores são fictícios e estáticos, com referência em 28/09/2026 às 14:40 BRT; apenas a cena do mapa é animada. O mapa é esquemático, sem escala, coordenadas ou posicionamento real. Não há autenticação, comunicação com equipes, envio de comandos ou integração de telemetria. A ciência do alerta existe apenas na página atual; recarregar reinicia a demonstração. O protótipo usa HTML, CSS e SVG locais, sem dependências externas.

### ✨ Versão 2 — Cena 3D Cinematic (`index-v2.html`)

Mesma moldura de monitoramento, mesmos dados mock e mesmo painel/comandos; muda apenas a cena 3D:

- **Render cinematográfico:** reflexos de ambiente (PMREM), bloom, contorno azul no ativo selecionado, névoa e sombras suaves.
- **Galpão detalhado:** piso de concreto texturizado, faixas de circulação, zonas de segurança zebradas, paredes de vidro, luminárias suspensas com feixes de luz, painel LED "Grupo GPS" e poeira no ar.
- **Máquinas animadas:** CNC com janela e spindle girando, robôs de 6 eixos articulados (ROB-003 caído/offline), esteiras com correia e caixas em movimento, empilhadeiras com rodas, garfo e giroflex, injetoras com cilindros aquecidos (INJ-002 pulsando), prensa com curso do martelo e cortina de luz, célula de solda com faíscas e arco elétrico.
- **Sinalização IoT:** torre de luz (andon) e tela IHM com gráfico ao vivo em cada máquina; feixe holográfico sobre ativos em alerta/offline.
- **Câmera:** entrada cinematográfica e "modo vitrine" (órbita automática após 20 s sem interação).

```bash
start index-v2.html
```

## 📊 Dados Mockados

Todos os dados estão no array `MACHINES` no início do script (linha ~50 do `index.html`).

### Máquinas disponíveis

| ID | Nome | Tipo | Status | Observação |
|----|------|------|--------|------------|
| CNC-001 | Torno CNC 1 | cnc | ✅ Online | |
| CNC-002 | Torno CNC 2 | cnc | ✅ Online | |
| CNC-003 | Fresa CNC 1 | cnc | ⚠️ Alerta | Temperatura elevada (89°C) |
| ROB-001 | Braço Robô A | robot | ✅ Online | Gira continuamente |
| ROB-002 | Braço Robô B | robot | ✅ Online | Gira continuamente |
| ROB-003 | Braço Robô C | robot | ❌ Offline | |
| CVY-001 | Esteira 1 | conveyor | ✅ Online | |
| CVY-002 | Esteira 2 | conveyor | ✅ Online | |
| CVY-003 | Esteira 3 | conveyor | ⚠️ Alerta | Vibração elevada |
| FKL-001 | Empilhadeira 1 | forklift | ✅ Online | 🔄 Em movimento |
| FKL-002 | Empilhadeira 2 | forklift | ✅ Online | 🔄 Em movimento |
| FKL-003 | Empilhadeira 3 | forklift | ⚠️ Alerta | 🔄 Em movimento |
| INJ-001 | Injetora 1 | injector | ✅ Online | |
| INJ-002 | Injetora 2 | injector | ⚠️ Alerta | Temperatura crítica (210°C) |
| PRE-001 | Prensa Hidráulica | press | ✅ Online | |
| WLD-001 | Solda Robótica | welder | ✅ Online | |

### Métricas por máquina

Cada máquina possui:
- **Temperatura** (°C) — simulada conforme o tipo
- **Vibração** (mm/s) — indicador de desgaste
- **Uso** (%) — percentual de utilização

### Status

- 🟢 **Online** — operando normalmente
- 🟡 **Alerta** — parâmetro fora do ideal (ex: temperatura ou vibração alta)
- 🔴 **Offline** — máquina desligada ou sem comunicação

## 🎮 Funcionalidades

### Moldura de monitoramento (mock)

A animação 3D roda dentro de um container central, cercado pela interface de operação:

- **Topbar** — logo do Grupo GPS, identificação da unidade/turno, relógio e o bloco do **operador autenticado** (nome, matrícula, perfil, badge "Autenticado", botão de encerrar sessão)
- **Painel esquerdo** — dados da sessão (usuário, perfil de acesso, login, expiração, permissão de comando), passo a passo de como operar o painel, procedimento em caso de alerta e contatos do turno
- **Painel direito** — alertas ativos, indicadores do turno (disponibilidade, OEE, produção) e checklist do operador
- **Barra de status** — aviso de ambiente de demonstração, broker MQTT, gateways de borda, latência e última atualização

> ⚠️ Todos os dados — inclusive o operador autenticado, login e sessão — são **mockados**. Não há autenticação real.

### Interações

1. **Clique em qualquer máquina** — abre painel com métricas em tempo real
2. **Envio de comandos** — selecione um comando e clique "Enviar" para simular controle
3. **Empilhadeiras animadas** — 3 veículos percorrendo trajetos predefinidos
4. **Braços robóticos** — animação de rotação contínua
5. **HUD** — contagem de máquinas por status no topo
6. **Paredes de vidro** — ambiente de galpão industrial

### Comandos disponíveis

- `EMERGENCY_STOP` — Parada de emergência
- `PAUSE` — Pausar operação
- `RESUME` — Retomar operação
- `CALIBRATE` — Calibrar sensores
- `SPEED_UP` — Aumentar velocidade
- `SLOW_DOWN` — Reduzir velocidade
- `CYCLE_START` — Iniciar ciclo

## 🛠️ Tecnologia

- [Three.js](https://threejs.org/) — Renderização 3D via WebGL
- CSS2DRenderer — Labels sobrepostos
- OrbitControls — Navegação livre pela cena