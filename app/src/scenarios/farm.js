// Catálogo, parâmetros, comandos e cópia da simulação AI Farm. Somente mock.
import { MODES } from '../shared/machines.js';
import { runningState } from '../shared/simulation.js';
import { VEHICLE_ROUTES, routePose } from '../scene/farmLayout.js';

export const FARM_TYPE_LABEL = {
  tractor: 'Trator agrícola',
  harvester: 'Colheitadeira',
  sprayer: 'Pulverizador',
  pivot: 'Pivô de irrigação',
  truck: 'Caminhão graneleiro',
  cattle: 'Lote bovino · coleira IoT',
  sheep: 'Rebanho ovino · coleira IoT',
  barn: 'Celeiro de grãos',
  silo: 'Silo',
  piggery: 'Criadouro de suínos',
};

const fieldMetrics = [
  { key: 'temp', label: 'Temperatura', unit: '°C', digits: 0, limit: 'tempLimit' },
  { key: 'speedKmh', label: 'Velocidade', unit: 'km/h', digits: 1, scale: 28 },
  { key: 'fuel', label: 'Combustível', unit: '%', digits: 0, limit: 'fuelMin', invert: true, scale: 100 },
];
const herdMetrics = [
  { key: 'temp', label: 'Temperatura', unit: '°C', digits: 1, limit: 'tempLimit' },
  { key: 'activity', label: 'Atividade', unit: '%', digits: 0, limit: 'activityLimit', scale: 100 },
  { key: 'outside', label: 'Fora da cerca', unit: 'cab', digits: 0, limit: 'outsideLimit', scale: 8 },
];
const barnMetrics = [
  { key: 'temp', label: 'Temperatura', unit: '°C', digits: 0, limit: 'tempLimit' },
  { key: 'humidity', label: 'Umidade', unit: '%', digits: 0, limit: 'humidityLimit', scale: 100 },
  { key: 'nh3', label: 'Amônia', unit: 'ppm', digits: 0, limit: 'nh3Limit' },
];
const siloMetrics = [
  { key: 'temp', label: 'Temperatura', unit: '°C', digits: 0, limit: 'tempLimit' },
  { key: 'humidity', label: 'Umidade', unit: '%', digits: 0, limit: 'humidityLimit', scale: 100 },
  { key: 'usage', label: 'Nível', unit: '%', digits: 0, scale: 100 },
];

const modeField = { label: 'Modo de operação', kind: 'select', options: MODES };
const fieldSchema = {
  mode: modeField,
  speed: { label: 'Velocidade', unit: '%', min: 0, max: 130, step: 5 },
  targetTemp: { label: 'Temperatura alvo', unit: '°C', min: 20, max: 110, step: 1 },
  tempLimit: { label: 'Limite de alarme · temperatura', unit: '°C', min: 40, max: 120, step: 1 },
  fuelMin: { label: 'Mínimo de combustível', unit: '%', min: 5, max: 40, step: 1 },
};
const herdSchema = {
  mode: modeField,
  speed: { label: 'Atividade alvo', unit: '%', min: 0, max: 130, step: 5 },
  targetTemp: { label: 'Temperatura corporal alvo', unit: '°C', min: 36, max: 40, step: 0.1 },
  tempLimit: { label: 'Limite de alarme · temperatura', unit: '°C', min: 37.5, max: 42, step: 0.1 },
  activityLimit: { label: 'Limite de atividade', unit: '%', min: 40, max: 100, step: 1 },
  outsideLimit: { label: 'Animais fora da cerca', unit: 'cab', min: 0, max: 12, step: 1 },
};
const barnSchema = {
  mode: modeField,
  speed: { label: 'Ventilação', unit: '%', min: 0, max: 130, step: 5 },
  targetTemp: { label: 'Temperatura alvo', unit: '°C', min: 16, max: 34, step: 1 },
  tempLimit: { label: 'Limite de alarme · temperatura', unit: '°C', min: 22, max: 40, step: 1 },
  humidityLimit: { label: 'Limite de umidade', unit: '%', min: 45, max: 90, step: 1 },
  nh3Limit: { label: 'Limite de amônia', unit: 'ppm', min: 8, max: 40, step: 1 },
};
const siloSchema = {
  mode: modeField,
  speed: { label: 'Aeração', unit: '%', min: 0, max: 130, step: 5 },
  targetTemp: { label: 'Temperatura alvo', unit: '°C', min: 12, max: 30, step: 1 },
  tempLimit: { label: 'Limite de alarme · temperatura', unit: '°C', min: 20, max: 40, step: 1 },
  humidityLimit: { label: 'Limite de umidade', unit: '%', min: 40, max: 80, step: 1 },
};

const SCHEMA = {
  tractor: fieldSchema, harvester: fieldSchema, sprayer: fieldSchema, pivot: fieldSchema, truck: fieldSchema,
  cattle: herdSchema, sheep: herdSchema,
  barn: barnSchema, piggery: barnSchema, silo: siloSchema,
};

export function farmParamSchema(type) {
  return SCHEMA[type] || fieldSchema;
}

const COMMANDS = {
  field: [
    { id: 'EMERGENCY_STOP', label: '🛑 Parada de emergência', confirm: true },
    { id: 'PAUSE', label: '⏸️ Pausar' },
    { id: 'RESUME', label: '▶️ Retomar' },
    { id: 'SPEED_UP', label: '⚡ Acelerar' },
    { id: 'SLOW_DOWN', label: '🐢 Reduzir' },
    { id: 'CALIBRATE', label: '🔧 Calibrar' },
    { id: 'CYCLE_START', label: '🔄 Reiniciar ciclo' },
  ],
  herd: [
    { id: 'EMERGENCY_STOP', label: '🛑 Conter lote', confirm: true },
    { id: 'PAUSE', label: '⏸️ Pausar alerta' },
    { id: 'RESUME', label: '▶️ Retomar monitoramento' },
    { id: 'CALIBRATE', label: '📍 Localizar lote' },
    { id: 'SLOW_DOWN', label: '🐑 Acalmar lote' },
    { id: 'CYCLE_START', label: '🔄 Reiniciar ciclo' },
  ],
  barn: [
    { id: 'EMERGENCY_STOP', label: '🛑 Exaustão de emergência', confirm: true },
    { id: 'PAUSE', label: '⏸️ Pausar climatização' },
    { id: 'RESUME', label: '▶️ Retomar' },
    { id: 'SPEED_UP', label: '💨 Aumentar ventilação' },
    { id: 'SLOW_DOWN', label: '🌬️ Reduzir ventilação' },
    { id: 'CALIBRATE', label: '🔧 Calibrar sensores' },
    { id: 'CYCLE_START', label: '🔄 Reiniciar ciclo' },
  ],
};

function place(pos) {
  const lat = -21.1772 + pos[2] * 0.00009;
  const lon = -47.8094 + pos[0] * 0.00009;
  return {
    location: `${Math.abs(lat).toFixed(5)}°S, ${Math.abs(lon).toFixed(5)}°W`,
    lat, lon,
  };
}

function asset(row) {
  const [id, name, type, family, initialPos, temp, extra = {}] = row;
  const pose = VEHICLE_ROUTES[id] ? routePose(VEHICLE_ROUTES[id], 0) : null;
  const pos = pose ? [pose.x, 0, pose.z] : initialPos;
  const geo = place(pos);
  const defaults = { mode: 'auto', speed: 100, targetTemp: temp, ...(extra.params || {}) };
  const params = { ...defaults, ...(extra.override || {}) };
  const m = {
    id, name, type, family, pos, moving: !!extra.moving,
    typeLabel: FARM_TYPE_LABEL[type],
    metrics: extra.metrics,
    base: {
      temp, vib: extra.vib ?? 0.3, usage: extra.usage ?? 60, targetTemp: temp,
      speedKmh: extra.speedKmh, humidity: extra.humidity, nh3: extra.nh3, activity: extra.activity,
    },
    params, defaults, commLost: false,
    temp: extra.temp ?? temp,
    vib: extra.vib ?? 0.3,
    usage: extra.usage ?? 60,
    fuel: extra.fuel,
    humidity: extra.humidity,
    nh3: extra.nh3,
    activity: extra.activity,
    outside: extra.outside,
    headcount: extra.headcount,
    speedKmh: extra.speedKmh,
    ...geo,
    status: 'online',
    reasons: [],
    lastSeen: Date.now(),
  };
  m.isRunning = runningState(m);
  return m;
}

const RAW = [
  ['TRT-001', 'Trator A', 'tractor', 'field', [-8, 0, -4], 74, { moving: true, fuel: 71, speedKmh: 18, usage: 64, params: { tempLimit: 95, fuelMin: 15 }, metrics: fieldMetrics }],
  ['TRT-002', 'Trator B', 'tractor', 'field', [-1, 0, -6], 31, { fuel: 44, speedKmh: 18, usage: 0, vib: 0, temp: 31, params: { tempLimit: 95, fuelMin: 15 }, override: { mode: 'off', speed: 0 }, metrics: fieldMetrics }],
  ['COL-001', 'Colheitadeira', 'harvester', 'field', [4, 0, -6], 81, { fuel: 14, speedKmh: 8, usage: 77, params: { tempLimit: 98, fuelMin: 25 }, metrics: fieldMetrics }],
  ['PUL-001', 'Pulverizador', 'sprayer', 'field', [-6, 0, 1], 63, { moving: true, fuel: 58, speedKmh: 14, usage: 51, params: { tempLimit: 90, fuelMin: 15 }, metrics: fieldMetrics }],
  ['IRR-001', 'Pivô Central', 'pivot', 'field', [11, 0, -6], 41, { fuel: 66, speedKmh: 3.2, usage: 83, params: { tempLimit: 70, fuelMin: 12 }, metrics: fieldMetrics }],
  ['CAM-001', 'Caminhão Graneleiro', 'truck', 'field', [9, 0, 4], 69, { moving: true, fuel: 49, speedKmh: 22, usage: 46, params: { tempLimit: 92, fuelMin: 15 }, metrics: fieldMetrics }],
  ['BOV-001', 'Lote Nelore Norte', 'cattle', 'herd', [-8, 0, 6], 38.6, { moving: true, activity: 42, outside: 0, headcount: 48, usage: 42, vib: 0.1, params: { tempLimit: 39.5, activityLimit: 80, outsideLimit: 2 }, metrics: herdMetrics }],
  ['BOV-002', 'Lote Angus Sul', 'cattle', 'herd', [-4, 0, 8], 40.2, { moving: true, activity: 55, outside: 1, headcount: 36, usage: 55, vib: 0.1, params: { tempLimit: 39.4, activityLimit: 80, outsideLimit: 2 }, metrics: herdMetrics }],
  ['BOV-003', 'Bezerros', 'cattle', 'herd', [-9, 0, 10], 38.8, { moving: true, activity: 61, outside: 0, headcount: 22, usage: 48, vib: 0.1, params: { tempLimit: 39.8, activityLimit: 85, outsideLimit: 1 }, metrics: herdMetrics }],
  ['OVI-001', 'Rebanho Ovino', 'sheep', 'herd', [-3, 0, 11], 39.0, { moving: true, activity: 47, outside: 1, headcount: 64, usage: 40, vib: 0.1, params: { tempLimit: 39.7, activityLimit: 82, outsideLimit: 3 }, metrics: herdMetrics }],
  ['CEL-001', 'Celeiro de Grãos', 'barn', 'barn', [6, 0, 8], 24, { humidity: 58, nh3: 3, usage: 70, vib: 0.15, params: { tempLimit: 32, humidityLimit: 75, nh3Limit: 15 }, metrics: barnMetrics }],
  ['SIL-001', 'Silo 1', 'silo', 'barn', [9.4, 0, 6.6], 22, { humidity: 52, usage: 81, vib: 0.1, params: { tempLimit: 30, humidityLimit: 68 }, metrics: siloMetrics }],
  ['SIL-002', 'Silo 2', 'silo', 'barn', [11.2, 0, 7.4], 23, { humidity: 49, usage: 64, vib: 0.1, params: { tempLimit: 30, humidityLimit: 68 }, metrics: siloMetrics }],
  ['SUI-001', 'Maternidade', 'piggery', 'barn', [5, 0, 12], 27, { humidity: 66, nh3: 11, usage: 73, vib: 0.2, params: { tempLimit: 32, humidityLimit: 78, nh3Limit: 18 }, metrics: barnMetrics }],
  ['SUI-002', 'Creche', 'piggery', 'barn', [8.6, 0, 12], 26, { humidity: 64, nh3: 9, usage: 68, vib: 0.2, params: { tempLimit: 32, humidityLimit: 78, nh3Limit: 18 }, metrics: barnMetrics }],
  ['SUI-003', 'Terminação', 'piggery', 'barn', [12, 0, 12], 29, { humidity: 71, nh3: 26, usage: 84, vib: 0.25, params: { tempLimit: 33, humidityLimit: 80, nh3Limit: 18 }, metrics: barnMetrics }],
];

export function createFarmAssets() {
  return RAW.map(asset);
}

const fmt = (n, d = 0) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

export const farmKb = {
  tractor: {
    how: 'Trator agrícola conectado: GPS de bordo, sensor de temperatura do motor e sonda de combustível. A velocidade de trabalho e a rota no talhão aparecem na cena; a IHM local repete o estado do gateway.',
    causes: ['carga do implemento acima do recomendado', 'filtro de ar obstruído elevando a temperatura', 'consumo alto em solo pesado', 'sensor de nível com leitura instável'],
    maint: ['checklist diário de óleo, água e pneus', 'drenar o pré-filtro de combustível', 'conferir antena GPS e gateway', 'calibrar o sensor de nível a cada abastecimento'],
  },
  harvester: {
    how: 'Colheitadeira: plataforma, rotor e motor diesel instrumentados. Temperatura, velocidade de avanço e combustível seguem o mesmo contrato de telemetria das máquinas de campo.',
    causes: ['plataforma muito baixa gerando esforço', 'palha úmida sobrecarregando o rotor', 'radiador sujo', 'tanque abaixo do mínimo operacional'],
    maint: ['limpar radiador e peneiras no fim do turno', 'inspecionar navalhas', 'abastecer antes do mínimo configurado', 'revisar correias do rotor'],
  },
  sprayer: {
    how: 'Pulverizador autopropelido: barras, bomba e tanque. A telemetria traz temperatura, velocidade de aplicação e combustível; a barra para junto com a parada de emergência.',
    causes: ['bicos entupidos exigindo mais pressão', 'velocidade acima da faixa de gota', 'combustível baixo no meio do talhão', 'bomba trabalhando fora do ponto'],
    maint: ['lavar barras e filtros', 'calibrar vazão', 'verificar estabilidade das barras', 'conferir nível antes de entrar no talhão'],
  },
  pivot: {
    how: 'Pivô central: torre e lance giram sobre o talhão. O gerador de apoio publica temperatura e combustível; a velocidade exibida é o giro do lance, não um deslocamento livre.',
    causes: ['bicos entupidos', 'gerador em carga contínua', 'desalinhamento da torre', 'pressão de água irregular'],
    maint: ['inspecionar aspersores', 'lubrificar redutores das torres', 'testar a parada do lance', 'conferir combustível do gerador'],
  },
  truck: {
    how: 'Caminhão graneleiro: rastreamento de pátio, temperatura do conjunto e combustível. A rota desenhada é o circuito entre silos e colheita.',
    causes: ['espera com motor ligado', 'excesso de carga', 'pneus com pressão irregular', 'combustível abaixo do mínimo de retorno'],
    maint: ['checklist de freios e lona', 'calibrar pneus', 'evitar marcha lenta prolongada', 'abastecer no pátio'],
  },
  cattle: {
    how: 'Lote bovino com coleiras IoT: cada animal contribui para temperatura média, atividade e contagem fora da cerca virtual. O painel trata o lote como um ativo, no mesmo modelo de uma máquina.',
    causes: ['animal com febre puxando a média do lote', 'cocho vazio aumentando a atividade', 'cerca virtual estreita', 'coleira sem comunicação'],
    maint: ['varrer coleiras sem batimento', 'conferir água e cocho', 'revisar a cerca virtual', 'separar animais acima do limite de temperatura'],
  },
  sheep: {
    how: 'Rebanho ovino monitorado por coleira: mesma telemetria de lote (temperatura, atividade e animais fora da cerca), com cerca mais ampla que a dos bezerros.',
    causes: ['agrupamento fora do piquete', 'estresse térmico', 'atividade acima do limite', 'falha de uma coleira repetidora'],
    maint: ['revisar bebedouro', 'conferir cerca física e virtual', 'manejar no período fresco', 'trocar coleiras com bateria baixa'],
  },
  barn: {
    how: 'Celeiro: sensores de temperatura, umidade e qualidade do ar. A ventilação é o setpoint de velocidade; a exaustão de emergência tira o galpão do modo automático.',
    causes: ['portas fechadas com grão úmido', 'ventilação insuficiente', 'sensor de umidade fora de calibração', 'carga nova ainda quente'],
    maint: ['calibrar termo-higrômetro', 'testar exaustores', 'não misturar lotes úmidos', 'registrar a leitura antes de secar'],
  },
  silo: {
    how: 'Silo: temperatura da massa, umidade do ar interno e nível. A aeração conduz a temperatura ao alvo, como a velocidade conduz o equilíbrio térmico na fábrica.',
    causes: ['aeração desligada', 'umidade de entrada alta', 'nível acima da janela de secagem', 'ponto quente local não visível na média'],
    maint: ['ligar aeração no período seco', 'medir umidade na recepção', 'não completar o silo com grão quente', 'calibrar a sonda de nível'],
  },
  piggery: {
    how: 'Criadouro de suínos: galpão climatizado com temperatura, umidade e amônia (NH3). A ventilação é o comando de velocidade; a exaustão de emergência tira o galpão de automático.',
    causes: ['cama úmida elevando NH3', 'ventilação mínima insuficiente', 'densidade acima do previsto', 'cortina fechada no calor'],
    maint: ['manejar cama e dejetos', 'testar exaustores e entradas de ar', 'aferir o sensor de NH3', 'conferir densidade da baia'],
  },
};

export const farmProfile = {
  id: 'farm',
  forceMock: true,
  documentTitle: 'AI Farm — Central de Monitoramento IoT',
  plant: 'Fazenda Santa Luzia · Talhão Norte · Turno diurno',
  operator: { login: 'a.ribeiro', name: 'Ana Ribeiro', avatar: 'AR', meta: 'Matrícula 11820 · Gestora da propriedade' },
  initialKpis: { pieces: 0, commands: 3, paramChanges: 0, unplanned: 1 },
  kb: farmKb,
  createAssets: createFarmAssets,
  paramSchema: farmParamSchema,
  commandsFor: (asset) => COMMANDS[asset?.family] || COMMANDS.field,
  publishNote: 'Alterações são pré-visualizadas ao vivo. <b>Aplicar</b> publica no simulador local do ativo.',
  previewNote: '<span class="preview-tag">PRÉ-VISUALIZAÇÃO</span> Status e limites já refletem o ajuste. <b>Aplicar</b> sincroniza com o gêmeo simulado e a telemetria converge.',
  envBadge() { return 'Telemetria simulada · Agente mock · AI Farm'; },
  kpiRows(s) {
    const running = s.machines.filter((m) => m.status !== 'offline');
    const avail = s.machines.length ? running.length / s.machines.length : 0;
    const field = s.machines.filter((m) => m.family === 'field' && Number.isFinite(m.fuel));
    const fuel = field.length ? field.reduce((a, m) => a + m.fuel, 0) / field.length : 0;
    const animals = s.machines.filter((m) => m.family === 'herd').reduce((a, m) => a + (m.headcount || 0), 0);
    const barnAlert = s.machines.filter((m) => m.family === 'barn' && m.status === 'alert').length;
    const color = avail >= 0.9 ? 'var(--green)' : avail >= 0.75 ? 'var(--yellow)' : 'var(--red)';
    return [
      { label: 'Disponibilidade', value: `${fmt(avail * 100, 1)} %`, color },
      { label: 'Combustível médio', value: `${fmt(fuel, 0)} %`, color: fuel < 30 ? 'var(--yellow)' : 'var(--green)' },
      { label: 'Animais monitorados', value: fmt(animals) },
      { label: 'Instalações em alerta', value: String(barnAlert), color: barnAlert ? 'var(--yellow)' : 'var(--green)' },
      { label: 'Comandos enviados', value: String(s.kpis.commands) },
      { label: 'Ajustes de parâmetros', value: String(s.kpis.paramChanges) },
    ];
  },
  chrome: {
    wordmark: 'AI <b>Farm</b>',
    title: 'Central de Monitoramento IoT — AI Farm',
    subtitle: 'Fazenda Santa Luzia · Talhão Norte · Turno diurno (06:00 – 14:00)',
    hud: '🌾 AI Farm <small>SPA · reativa · telemetria simulada</small>',
    assetsTitle: 'Ativos da propriedade',
    howtoTitle: 'Como operar o painel',
    howto: [
      '<b>Selecione um ativo</b> — máquina de campo, lote ou instalação, na cena 3D ou na lista.',
      '<b>Ajuste parâmetros</b> — velocidade, temperatura, combustível mínimo, cerca ou ventilação. A pré-visualização já muda alertas e ritmo.',
      '<b>Envie um comando</b> — parar, conter lote ou acionar exaustão. O mock confirma na hora, como na fábrica.',
      '<b>Pergunte ao assistente</b> — a base local explica alarmes de combustível, coleira e amônia. Este cenário não usa Foundry.',
    ],
    procTitle: 'Procedimento em caso de alerta',
    proc: [
      'Confirme a leitura no painel do ativo antes de agir.',
      'Combustível no mínimo: reduza a velocidade e retorne o equipamento para abastecer.',
      'Animal fora da cerca ou febre no lote: use <b>Localizar lote</b> e contenha se o risco persistir.',
      'Amônia ou calor no galpão: aumente a ventilação. Risco ao plantel: <b>Exaustão de emergência</b>.',
    ],
    callout: '<b>Demonstração:</b> a AI Farm usa somente o simulador local. Os mesmos gestos da fábrica — selecionar, ajustar, comandar e perguntar — valem para o campo, o rebanho e os galpões.',
    contactsTitle: 'Contatos da propriedade',
    contacts: [
      ['Capatazia', 'Ramal 2101'],
      ['Veterinária', 'Ramal 2144'],
      ['Manutenção agrícola', 'Ramal 2170'],
      ['Suporte IoT', 'Ramal 2008'],
    ],
    session: [
      ['Usuário', 'a.ribeiro'],
      ['Perfil de acesso', 'Gestão · Nível 2'],
      ['Login em', '06:05'],
      ['Permissão de comando', 'Liberada'],
    ],
    kpiTitle: 'Indicadores da propriedade',
    syncTitle: 'Sincronização do gateway',
    syncSource: 'Simulador local · gateway da fazenda',
    gateway: 'Gateway da propriedade',
    footer: 'AI Farm · telemetria simulada · mesmas funções do chão de fábrica · v1.0.0',
    contextAll: 'fazenda inteira',
    summaryChip: 'Resumo da fazenda',
    askPlaceholder: 'Pergunte sobre máquinas, rebanhos ou galpões…',
  },
  assistant: {
    intro: 'Olá! Sou o assistente da AI Farm. Posso explicar tratores, colheita, coleiras do rebanho e o clima dos galpões — com o mesmo tipo de resposta do mock da fábrica.\nEste cenário não consulta Foundry nem Fabric.',
    empty: 'Posso explicar máquinas de campo, rebanhos e instalações.\nSelecione um ativo na cena ou cite o código (ex.: "Por que a SUI-003 está em alerta?").',
    commands: 'Comandos neste cenário (mesmo canal do mock da fábrica):\n• Parada de emergência / conter lote / exaustão — modo Desligado\n• Pausar / retomar — interrompe e devolve o ciclo\n• Acelerar / reduzir — ±10% de velocidade, ventilação ou atividade\n• Calibrar / localizar — recalibra o sensor ou aproxima o lote da cerca\n• Reiniciar ciclo — volta ao modo Automático',
  },
};
