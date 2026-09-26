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