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