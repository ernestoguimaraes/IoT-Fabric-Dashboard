// Dados mock das máquinas (mesmos ativos/valores da v2) + setpoints operacionais.
// Usado pelo front-end e pelo servidor (simulador de dispositivos).

export const MODES = {
  auto: 'Automático',
  manual: 'Manual',
  paused: 'Pausado',
  off: 'Desligado',
};

// Schema de parâmetros por tipo — define rótulos, faixas e unidades da janela de ajuste.
const common = {
  mode: { label: 'Modo de operação', kind: 'select', options: MODES },
  speed: { label: 'Velocidade', unit: '%', min: 0, max: 130, step: 5 },
  targetTemp: { label: 'Temperatura alvo', unit: '°C', min: 20, max: 120, step: 1 },
  tempLimit: { label: 'Limite de alarme · temperatura', unit: '°C', min: 30, max: 140, step: 1 },
  vibLimit: { label: 'Limite de alarme · vibração', unit: 'mm/s', min: 0.2, max: 4, step: 0.1 },
  cycleTime: { label: 'Tempo de ciclo', unit: 's', min: 2, max: 120, step: 1 },
};

const typeOverrides = {
  cnc: { speed: { label: 'Rotação do spindle' }, cycleTime: { label: 'Tempo de ciclo de usinagem' } },
  robot: { speed: { label: 'Velocidade dos eixos' }, cycleTime: { label: 'Tempo de ciclo pick & place' } },
  conveyor: { speed: { label: 'Velocidade da correia' }, cycleTime: { label: 'Intervalo entre volumes' } },
  forklift: { speed: { label: 'Velocidade de deslocamento' }, cycleTime: { label: 'Tempo de ciclo de movimentação', max: 300 } },
  injector: {
    speed: { label: 'Velocidade de injeção' },
    targetTemp: { label: 'Temperatura do canhão', min: 150, max: 260 },
    tempLimit: { min: 160, max: 280 },
    cycleTime: { label: 'Tempo de ciclo de injeção' },
  },
  press: { speed: { label: 'Cadência do martelo' }, cycleTime: { label: 'Tempo por golpe' } },
  welder: {
    speed: { label: 'Velocidade de soldagem' },
    targetTemp: { label: 'Temperatura do arco (referência)', min: 200, max: 450 },
    tempLimit: { min: 250, max: 500 },
    cycleTime: { label: 'Tempo por cordão' },
  },
};

export const PARAM_KEYS = ['mode', 'speed', 'targetTemp', 'tempLimit', 'vibLimit', 'cycleTime'];

export function paramSchema(type) {
  const o = typeOverrides[type] || {};
  const out = {};
  for (const k of PARAM_KEYS) out[k] = { ...common[k], ...(o[k] || {}) };
  return out;
}

export const TYPE_LABEL = {
  cnc: 'Centro de usinagem CNC', robot: 'Robô industrial 6 eixos', conveyor: 'Esteira transportadora',
  forklift: 'Empilhadeira elétrica', injector: 'Injetora de plástico', press: 'Prensa hidráulica',
  welder: 'Célula de solda robotizada',
};

// base = leitura de referência (velocidade 100 %, temperatura alvo padrão), usada pelo simulador.
const RAW = [
  ['CNC-001', 'Torno CNC 1', 'cnc', [-8, 0, -6], 72, 0.8, 87, { tempLimit: 85, vibLimit: 1.5, cycleTime: 42 }],
  ['CNC-002', 'Torno CNC 2', 'cnc', [-4, 0, -6], 68, 0.6, 92, { tempLimit: 85, vibLimit: 1.5, cycleTime: 38 }],
  ['CNC-003', 'Fresa CNC 1', 'cnc', [0, 0, -6], 89, 1.4, 76, { tempLimit: 85, vibLimit: 1.5, cycleTime: 55 }],
  ['ROB-001', 'Braço Robô A', 'robot', [-6, 0, -2], 55, 0.3, 64, { tempLimit: 70, vibLimit: 1.0, cycleTime: 8 }],
  ['ROB-002', 'Braço Robô B', 'robot', [-2, 0, -2], 52, 0.4, 71, { tempLimit: 70, vibLimit: 1.0, cycleTime: 8 }],
  ['ROB-003', 'Braço Robô C', 'robot', [2, 0, -2], 54, 0.35, 68, { tempLimit: 70, vibLimit: 1.0, cycleTime: 8 }, { commLost: true, temp: 30, vib: 0, usage: 0 }],
  ['CVY-001', 'Esteira 1', 'conveyor', [-7, 0, 2], 41, 0.2, 83, { tempLimit: 60, vibLimit: 0.6, cycleTime: 6 }],
  ['CVY-002', 'Esteira 2', 'conveyor', [-3, 0, 2], 39, 0.2, 79, { tempLimit: 60, vibLimit: 0.6, cycleTime: 6 }],
  ['CVY-003', 'Esteira 3', 'conveyor', [1, 0, 2], 58, 0.7, 91, { tempLimit: 60, vibLimit: 0.6, cycleTime: 5 }],
  ['FKL-001', 'Empilhadeira 1', 'forklift', [-5, 0, 6], 48, 0.5, 55, { tempLimit: 65, vibLimit: 1.2, cycleTime: 120 }],
  ['FKL-002', 'Empilhadeira 2', 'forklift', [3, 0, 6], 51, 0.6, 62, { tempLimit: 65, vibLimit: 1.2, cycleTime: 110 }],
  ['FKL-003', 'Empilhadeira 3', 'forklift', [7, 0, 6], 66, 1.1, 78, { tempLimit: 65, vibLimit: 1.2, cycleTime: 140 }],
  ['INJ-001', 'Injetora 1', 'injector', [-6, 0, 10], 185, 0.9, 94, { tempLimit: 195, vibLimit: 1.5, cycleTime: 24 }],
  ['INJ-002', 'Injetora 2', 'injector', [-2, 0, 10], 210, 1.3, 88, { tempLimit: 195, vibLimit: 1.5, cycleTime: 26 }],
  ['PRE-001', 'Prensa Hidráulica', 'press', [4, 0, 10], 62, 2.1, 45, { tempLimit: 80, vibLimit: 2.5, cycleTime: 12 }],
  ['WLD-001', 'Solda Robótica', 'welder', [8, 0, 10], 320, 0.4, 37, { tempLimit: 380, vibLimit: 1.0, cycleTime: 18 }],
];

export function createMachines() {
  return RAW.map(([id, name, type, pos, temp, vib, usage, p, extra = {}]) => {
    const params = { mode: 'auto', speed: 100, targetTemp: temp, ...p };
    return {
      id, name, type, pos,
      moving: type === 'forklift',
      base: { temp, vib, usage, targetTemp: temp },
      params,
      defaults: { ...params },
      commLost: !!extra.commLost,
      temp: extra.temp ?? temp,
      vib: extra.vib ?? vib,
      usage: extra.usage ?? usage,
      status: 'online',
      reasons: [],
      lastSeen: extra.commLost ? Date.now() - 25 * 60 * 1000 : Date.now(),
    };
  });
}
