// Agente mock: responde com base em uma base de conhecimento local + estado ao vivo.
// Mesmo contrato do adaptador Foundry: send(text, context) → { text, source }.

const KB = {
  cnc: {
    how: 'Centro de usinagem CNC: o spindle gira a ferramenta enquanto os eixos X/Y/Z deslocam a mesa conforme o programa G-code. O fluido de corte refrigera ferramenta e peça; a IHM mostra temperatura do cabeçote, vibração do spindle e utilização.',
    causes: ['ferramenta desgastada ou quebrada', 'fluido de corte baixo ou concentração incorreta', 'avanço/rotação acima do recomendado para o material', 'rolamentos do spindle com folga (vibração)'],
    maint: ['verificar nível e concentração do fluido de corte a cada turno', 'inspecionar desgaste de ferramentas (vida útil no CNC)', 'limpar cavacos da mesa e dos barramentos', 'lubrificar guias conforme plano preventivo'],
  },
  robot: {
    how: 'Robô industrial de 6 eixos: cada junta tem servomotor com encoder; o controlador interpola trajetórias pick & place. A garra pneumática abre/fecha no ciclo programado e a célula é protegida por intertravamentos.',
    causes: ['carga acima do payload ou mal centrada', 'redutores com folga (vibração)', 'cabo/encoder com falha (perda de comunicação)', 'ciclo muito curto aquecendo os servos'],
    maint: ['verificar cabos e conectores do braço (dress pack)', 'checar pressão de ar da garra', 'backup do programa do controlador', 'trocar graxa dos redutores conforme horas de operação'],
  },
  conveyor: {
    how: 'Esteira transportadora: motor elétrico com redutor aciona o tambor de tração; a correia leva os volumes entre estações. Um sensor fotoelétrico detecta passagem e a IHM local mostra a utilização.',
    causes: ['correia desalinhada ou com tensão incorreta', 'rolamentos dos roletes gastos', 'sobrecarga de volumes', 'acoplamento motor-redutor desalinhado'],
    maint: ['ajustar tensão e alinhamento da correia', 'lubrificar mancais', 'limpar sensores fotoelétricos', 'inspecionar emendas da correia'],
  },
  forklift: {
    how: 'Empilhadeira elétrica: motor de tração e bomba hidráulica alimentados por bateria; o garfo é elevado pelo mastro hidráulico. A telemetria traz temperatura do motor/controlador, vibração e utilização da frota.',
    causes: ['bateria com baixa carga exigindo mais corrente', 'pneus gastos ou piso irregular (vibração)', 'operação contínua sem pausa para resfriamento', 'óleo hidráulico baixo'],
    maint: ['checklist diário (freios, buzina, giroflex, garfos)', 'recarga/equalização da bateria', 'verificar desgaste dos pneus', 'nível de óleo hidráulico'],
  },
  injector: {
    how: 'Injetora de plástico: o canhão aquecido por resistências plastifica o material; a rosca injeta no molde fechado pela unidade de fechamento (toggle). Após resfriamento o molde abre e a peça é extraída.',
    causes: ['resistência ou termopar do canhão com falha', 'setpoint de temperatura acima do especificado para o polímero', 'refrigeração do molde insuficiente', 'ciclo curto demais'],
    maint: ['aferir termopares das zonas de aquecimento', 'verificar circuito de água do molde', 'limpar funil e desumidificador', 'inspecionar bico e anel de bloqueio'],
  },
  press: {
    how: 'Prensa hidráulica de 4 colunas: a bomba pressuriza o cilindro principal que desce o martelo (slide) sobre a matriz. A cortina de luz de segurança interrompe o ciclo se alguém entrar na área.',
    causes: ['cadência acima do recomendado', 'folga nas buchas das colunas (vibração)', 'óleo hidráulico quente/contaminado', 'matriz mal fixada'],
    maint: ['testar a cortina de luz no início do turno', 'verificar temperatura e nível do óleo', 'reapertar fixação da matriz', 'checar vazamentos nas mangueiras'],
  },
  welder: {
    how: 'Célula de solda robotizada: robô com tocha MIG/MAG percorre o cordão programado; a fonte controla corrente/tensão do arco. Cortinas de proteção bloqueiam a radiação e as faíscas.',
    causes: ['bico de contato gasto', 'vazão de gás de proteção inadequada', 'velocidade de soldagem alta gerando instabilidade', 'cabo terra com mau contato'],
    maint: ['trocar bico de contato e limpar bocal', 'verificar vazão de gás', 'calibrar TCP da tocha', 'inspecionar cortinas de proteção'],
  },
};

const fmt = (n, d = 0) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

function describeParams(m) {
  const p = m.params;
  return `Modo ${p.modeLabel}, velocidade ${p.speed}%, temperatura alvo ${fmt(p.targetTemp)} °C, limites ${fmt(p.tempLimit)} °C / ${fmt(p.vibLimit, 1)} mm/s, ciclo ${p.cycleTime} s.`;
}

function explainStatus(m) {
  const t = m.telemetry;
  const head = `${m.id} · ${m.name} está **${m.statusLabel}** (${fmt(t.temp)} °C, ${fmt(t.vib, 1)} mm/s, uso ${t.usage}%).`;
  if (m.status === 'online') return `${head}\nTodos os sensores dentro dos limites configurados.\nParâmetros: ${describeParams(m)}`;
  const kb = KB[m.type];
  const lines = [head, '', 'Motivo:', ...m.reasons.map((r) => `• ${r}`), '', 'O que fazer:'];
  if (m.commLost) {
    lines.push('• Verifique alimentação e cabo de rede do gateway da máquina.', '• Envie RESUME para tentar reconectar o dispositivo.', '• Persistindo, acione Suporte TI / IoT (ramal 4008).');
  } else if (m.params.mode === 'off') {
    lines.push('• A máquina foi desligada pelo operador. Para retomar, envie RESUME ou mude o modo para Automático.');
  } else {
    const tempHigh = t.temp >= m.params.tempLimit;
    const vibHigh = t.vib >= m.params.vibLimit;
    if (tempHigh) lines.push(`• Reduza a velocidade (SLOW_DOWN) ou a temperatura alvo — hoje ${fmt(m.params.targetTemp)} °C; algo abaixo de ${fmt(m.params.tempLimit * 0.95)} °C deve normalizar.`);
    if (vibHigh) lines.push(`• Reduza a velocidade para ~${Math.max(50, m.params.speed - 20)}% ou aplique PAUSE e solicite inspeção mecânica.`);
    if (m.params.mode === 'paused') lines.push('• Operação pausada: envie RESUME quando a condição for liberada.');
    lines.push('', `Causas comuns em ${m.typeLabel.toLowerCase()}:`, ...kb.causes.slice(0, 3).map((c) => `• ${c}`));
  }
  return lines.join('\n');
}

function plantSummary(ctx) {
  const s = ctx.summary;
  const lines = [`Planta: ${s.online} online, ${s.alert} em alerta, ${s.offline} offline (de ${s.total}).`];
  if (ctx.alerts.length) {
    lines.push('', 'Pontos de atenção:');
    ctx.alerts.forEach((a) => lines.push(`• ${a.id} · ${a.name}: ${a.reasons[0] || a.status}`));
  } else lines.push('Nenhum alerta ativo. 👍');
  return lines.join('\n');
}

function findMachine(text, ctx) {
  const id = text.toUpperCase().match(/\b([A-Z]{3})-?(\d{3})\b/);
  if (id) {
    const key = `${id[1]}-${id[2]}`;
    if (ctx.selected?.id === key) return ctx.selected;
    const a = ctx.machines.find((m) => m.id === key);
    if (a) return { ...a, partial: true };
  }
  const lower = text.toLowerCase();
  const byName = ctx.machines.find((m) => lower.includes(m.name.toLowerCase()));
  if (byName) return ctx.selected?.id === byName.id ? ctx.selected : { ...byName, partial: true };
  return ctx.selected;
}

export function answer(text, ctx, snapshotOf) {
  const q = text.toLowerCase();
  let m = findMachine(text, ctx);
  if (m?.partial && snapshotOf) m = snapshotOf(m.id);
  const kb = m ? KB[m.type] : null;

  if (/resumo|planta|geral|todas|quais.*(alerta|máquinas)|status da linha/.test(q) || (!m && /alerta|alarme|status/.test(q))) {
    return plantSummary(ctx);
  }
  if (!m) {
    return 'Posso explicar o funcionamento, alarmes, parâmetros e manutenção de qualquer máquina da linha.\nSelecione um ativo na cena ou cite o código (ex.: "Por que a INJ-002 está em alerta?").';
  }
  if (/funciona|o que (é|faz)|como opera|princípio/.test(q)) {
    return `${m.id} · ${m.name} (${m.typeLabel})\n\n${kb.how}\n\nParâmetros atuais: ${describeParams(m)}`;
  }
  if (/manuten|preventiv|inspe|checklist/.test(q)) {
    return `Manutenção recomendada — ${m.typeLabel}:\n${kb.maint.map((x) => `• ${x}`).join('\n')}`;
  }
  if (/parâmetr|parametr|ajust|setpoint|velocidade|limite|ciclo|configur/.test(q)) {
    return `Parâmetros de ${m.id}: ${describeParams(m)}\n\nPadrão de fábrica: velocidade ${m.defaults.speed}%, alvo ${fmt(m.defaults.targetTemp)} °C, limites ${fmt(m.defaults.tempLimit)} °C / ${fmt(m.defaults.vibLimit, 1)} mm/s, ciclo ${m.defaults.cycleTime} s.\n\nDica: velocidade e tempo de ciclo afetam diretamente temperatura, vibração e uso. Use "⚙️ Ajustar parâmetros" — a pré-visualização mostra o efeito antes de aplicar.`;
  }
  if (/comando|emergenc|parar|pausar|retomar/.test(q)) {
    return 'Comandos disponíveis:\n• EMERGENCY_STOP — desliga imediatamente (modo Desligado)\n• PAUSE / RESUME — pausa e retoma o ciclo\n• SPEED_UP / SLOW_DOWN — ±10% de velocidade\n• CALIBRATE — recalibra sensores de vibração\n• CYCLE_START — inicia ciclo em modo Automático';
  }
  if (/causa|por que|porque|alerta|alarme|problema|status|está/.test(q)) return explainStatus(m);
  return explainStatus(m);
}

export function createMockAgent({ snapshotOf } = {}) {
  return {
    mode: 'mock',
    label: 'Agente local (mock)',
    async send(text, context) {
      await new Promise((r) => setTimeout(r, 450 + Math.random() * 500));
      return { text: answer(text, context, snapshotOf), source: 'Base de conhecimento local · estado ao vivo' };
    },
    reset() {},
  };
}
