// Perfil do chão de fábrica: cópia de UI e comandos. Os ativos continuam em shared/machines.js.
import { paramSchema } from '../shared/machines.js';

export const FACTORY_COMMANDS = [
  { id: 'EMERGENCY_STOP', label: '🛑 EMERGENCY_STOP', confirm: true },
  { id: 'PAUSE', label: '⏸️ PAUSE' },
  { id: 'RESUME', label: '▶️ RESUME' },
  { id: 'CALIBRATE', label: '🔧 CALIBRATE' },
  { id: 'SPEED_UP', label: '⚡ SPEED_UP' },
  { id: 'SLOW_DOWN', label: '🐢 SLOW_DOWN' },
  { id: 'CYCLE_START', label: '🔄 CYCLE_START' },
];

const fmt = (n, d = 0) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

export const factoryProfile = {
  id: 'factory',
  forceMock: false,
  documentTitle: 'AI Fabric — Central de Monitoramento IoT',
  plant: 'Unidade Industrial Guarulhos · Linha A · Turno 2',
  operator: { login: 'm.silveira', name: 'Marcos Silveira', avatar: 'MS', meta: 'Matrícula 20458 · Operador Sênior' },
  initialKpis: { pieces: 14820, commands: 7, paramChanges: 0, unplanned: 2 },
  paramSchema,
  commandsFor: () => FACTORY_COMMANDS,
  publishNote: 'Alterações são pré-visualizadas ao vivo. <b>Aplicar</b> publica no Eventstream para o dispositivo.',
  previewNote: '<span class="preview-tag">PRÉ-VISUALIZAÇÃO</span> Status e limites já refletem o ajuste. <b>Aplicar</b> publica no Eventstream e a telemetria converge.',
  envBadge(telemetryMode, agentMode) {
    return [
      telemetryMode === 'fabric' ? 'Telemetria: Fabric RTI' : 'Telemetria simulada',
      agentMode === 'foundry' ? 'Agente: Foundry' : 'Agente mock',
    ].join(' · ');
  },
  kpiRows(s) {
    const running = s.machines.filter((m) => m.status !== 'offline');
    const avail = s.machines.length ? running.length / s.machines.length : 0;
    const perf = running.length ? running.reduce((a, m) => a + Math.min(100, m.usage), 0) / running.length / 100 : 0;
    const quality = 0.985 - s.machines.filter((m) => m.status === 'alert').length * 0.004;
    const color = avail >= 0.9 ? 'var(--green)' : avail >= 0.75 ? 'var(--yellow)' : 'var(--red)';
    return [
      { label: 'Disponibilidade', value: `${fmt(avail * 100, 1)} %`, color },
      { label: 'OEE estimado', value: `${fmt(avail * perf * quality * 100, 1)} %` },
      { label: 'Peças produzidas', value: fmt(Math.floor(s.kpis.pieces || 0)) },
      { label: 'Paradas não planejadas', value: String(s.kpis.unplanned), color: s.kpis.unplanned ? 'var(--yellow)' : '' },
      { label: 'Comandos enviados', value: String(s.kpis.commands) },
      { label: 'Ajustes de parâmetros', value: String(s.kpis.paramChanges) },
    ];
  },
  chrome: {
    wordmark: 'AI <b>Fabric</b>',
    title: 'Central de Monitoramento IoT — Chão de Fábrica',
    subtitle: 'Unidade Industrial Guarulhos · Linha A · Turno 2 (14:00 – 22:00)',
    hud: '🏭 IoT Factory Floor <small>SPA · reativa · Fabric RTI</small>',
    assetsTitle: 'Ativos da linha',
    howtoTitle: 'Como operar o painel',
    howto: [
      '<b>Selecione um ativo</b> — clique na máquina (cena 3D ou lista acima) para abrir as métricas ao vivo.',
      '<b>Ajuste parâmetros</b> — use <b>⚙️ Ajustar parâmetros</b>: cada alteração já reflete na cena e nos alertas (pré-visualização). <b>Aplicar</b> sincroniza com o dispositivo.',
      '<b>Envie um comando</b> — escolha a ação e confirme em <b>Enviar</b>; o efeito aparece imediatamente.',
      '<b>Tire dúvidas</b> — o <b>Assistente IoT</b> (botão 🤖) explica alarmes e o funcionamento de cada máquina.',
    ],
    procTitle: 'Procedimento em caso de alerta',
    proc: [
      'Confirme a leitura do sensor no painel do ativo antes de qualquer ação.',
      'Temperatura acima do limite: aplique <b>SLOW_DOWN</b> ou reduza a temperatura alvo e acione a manutenção.',
      'Vibração acima do limite: aplique <b>PAUSE</b> e solicite inspeção mecânica.',
      'Risco à integridade física: acione <b>EMERGENCY_STOP</b> e comunique o supervisor.',
    ],
    callout: '<b>Atenção:</b> comandos de parada afetam a linha de produção. Use <kbd>EMERGENCY_STOP</kbd> apenas em situação de risco confirmado.',
    contactsTitle: 'Contatos do turno',
    contacts: [
      ['Supervisão', 'Ramal 4102'],
      ['Manutenção', 'Ramal 4177'],
      ['Segurança / SESMT', 'Ramal 4190'],
      ['Suporte TI / IoT', 'Ramal 4008'],
    ],
    session: [
      ['Usuário', 'm.silveira'],
      ['Perfil de acesso', 'Operação · Nível 2'],
      ['Login em', '14:02'],
      ['Permissão de comando', 'Liberada'],
    ],
    kpiTitle: 'Indicadores do turno',
    syncTitle: 'Sincronização Fabric RTI',
    syncSource: 'Fabric Eventhouse',
    gateway: 'Gateway de borda',
    footer: 'AI Fabric · Real-Time Intelligence + Foundry Agents · v1.0.0',
    contextAll: 'planta inteira',
    summaryChip: 'Resumo da planta',
    askPlaceholder: 'Pergunte sobre o funcionamento das máquinas…',
  },
};
