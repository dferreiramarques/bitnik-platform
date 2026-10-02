// Textos em português de Portugal. As chaves das peças são geradas (28 peças).
const SLOTS = ['head', 'chest', 'arm', 'port', 'legs'];
const FAMILIAS = ['bio', 'combat', 'agility', 'shield'];
const SLOT = { head: 'Cabeça', chest: 'Tronco', arm: 'Braço', port: 'Interface', legs: 'Pernas', cpu: 'CPU' };
const PECA = {
  head: ['Cabeça Básica', 'Cabeça Sensor', 'Cabeça IA'],
  chest: ['Tronco Leve', 'Tronco Blindado', 'Tronco Adaptativo'],
  arm: ['Braço Simples', 'Braço Laser', 'Braço Plasma'],
  port: ['Porta Série', 'Porta Dados', 'Antena Quântica'],
  legs: ['Pernas Standard', 'Pernas Turbo', 'Pernas Gravitação'],
};
const CPU = { bio: 'Bio-Core', combat: 'Combat Core', agility: 'Agility Core', shield: 'Shield Core', omni: 'Omni Core' };
const CIRCUITO = { central: 'Central', combate: 'Combate', mobilidade: 'Mobilidade', armas: 'Armas', processo: 'Processo' };

const nome = {};
for (const s of SLOTS) [1, 2, 3].forEach((n) => { nome[s + n] = `${PECA[s][n - 1]} (L${n})`; });
for (const f of FAMILIAS) [1, 2, 3].forEach((n) => { nome[f + n] = `${CPU[f]} L${n}`; });
nome.omni3 = 'Omni Core L3';

const gerado = {};
for (const [id, n] of Object.entries(nome)) {
  gerado[`peca.${id}`] = n;
  gerado[`moveLabel.COMPRAR.${id}`] = `Comprar ${n}`;
  gerado[`log.COMPRAR.${id}`] = `comprou ${n}`;
}
for (const s of SLOTS) {
  gerado[`moveLabel.FORJA.${s}`] = `Forja: ${PECA[s][0]}`;
  gerado[`log.FORJA.${s}1`] = `usou a Forja e ficou com ${PECA[s][0]}`;
}
for (const s of [...SLOTS, 'cpu']) gerado[`slot.${s}`] = SLOT[s];
for (const [id, n] of Object.entries(CIRCUITO)) {
  gerado[`circuito.${id}`] = `Circuito ${n}`;
  gerado[`log.CIRCUITO.${id}`] = `completou o Circuito ${n}: ganha um worker`;
}
for (const [f, n] of Object.entries(CPU)) gerado[`cpu.${f}`] = n;

export default {
  'game.name': 'Robot Maker',
  'game.tagline': 'Constrói o robot mais eficiente com workers, blocos e circuitos.',
  'move.COMPILADOR': 'Compilador: +3 L1',
  'move.OPTIMIZADOR': 'Optimizador: 2×L1 → 1×L2',
  'move.FORJA': 'Forja: peça L1 grátis',
  'move.DEPLOY': 'Deploy: +6 pontos',
  'move.COMPRAR': 'Comprar peça',
  'move.PASSAR': 'Passar',
  'move.IR_AO_MERCADO': 'Ir ao mercado',
  'err.FASE': 'Primeiro os workers no tabuleiro; só depois o mercado.',
  'log.IR_AO_MERCADO': 'foi ao mercado',
  'err.SEM_WORKERS': 'Não tens workers livres.',
  'err.SLOT_OCUPADO': 'Esse slot já está ocupado nesta ronda.',
  'err.RECURSOS': 'Não tens blocos suficientes.',
  'err.SEM_STOCK': 'A peça esgotou.',
  'err.NAO_VISIVEL': 'Essa peça não está à vista no mercado.',
  'err.NIVEL': 'Só podes subir um nível de cada vez: L1 num slot vazio, L2 sobre L1, L3 sobre L2.',
  'err.PECA_INVALIDA': 'Peça inválida para esta jogada.',
  'log.COMPILADOR': 'usou o Compilador: +3 L1',
  'log.OPTIMIZADOR': 'usou o Optimizador: 2×L1 → 1×L2',
  'log.OPTIMIZADOR_VAZIO': 'usou o Optimizador sem 2×L1: o worker gastou-se sem efeito',
  'log.FORJA_VAZIA': 'usou a Forja sem nenhum slot vazio: o worker gastou-se sem efeito',
  'log.DEPLOY': 'fez Deploy: +{n} pontos',
  'log.PASSAR': 'passou',
  'log.GATILHO': 'Robot completo! O jogo acaba depois de mais uma ronda sem este jogador.',
  'log.RONDA_EXTRA': 'Última ronda!',
  'log.FIM': 'O jogo acabou.',
  'log.RONDA': 'Ronda {n}',
  'log.ROTACAO': 'Ninguém adquiriu peças de nível {nivel}: o mercado roda.',
  'ui.round': 'Ronda {n}',
  'ui.roundOf': 'Ronda {n}/{max}',
  'ui.finalRound': 'Última ronda!',
  'ui.sitsOut': '{nome} já não joga',
  'ui.yourTurn': 'É a tua vez',
  'ui.turnOf': 'Vez de {nome}',
  'ui.workers': 'Workers',
  'ui.free': 'livres',
  'ui.points': 'pontos',
  'ui.estimate': 'Pontos agora',
  'ui.board': 'Tabuleiro',
  'ui.slot.compilador': 'Compilador',
  'ui.slot.optimizador': 'Optimizador',
  'ui.slot.forja': 'Forja',
  'ui.slot.deploy': 'Deploy',
  'ui.fx.compilador': '+3 L1 por worker',
  'ui.fx.optimizador': '2×L1 → 1×L2',
  'ui.fx.forja': '1 peça L1 grátis',
  'ui.fx.deploy': '+6 pontos',
  'ui.unlimited': 'ilimitado',
  'ui.exclusive': 'exclusivo',
  'ui.market': 'Mercado',
  'ui.level': 'Nível {n}',
  'ui.cpus': 'CPUs',
  'ui.deck': 'baralho: {n}',
  'ui.myRobot': 'O meu robot',
  'ui.robotOf': 'Robot de {nome}',
  'ui.empty': 'vazio',
  'ui.pass': 'Passar',
  'ui.cancel': 'Cancelar',
  'ui.pickSlot': 'Forja: escolhe a peça L1 grátis',
  'ui.circuits': 'Circuitos',
  'ui.circuitFree': 'livre',
  'ui.circuitTaken': 'recolhido',
  'ui.needs': 'Falta: {falta}',
  'ui.log': 'Registo',
  'ui.panel': 'Mercado e circuitos',
  'ui.spectating': 'A ver a partida.',
  'ui.waiting': 'À espera de {nome}…',
  'ui.cost': 'Custo',
  'ui.breakdown': 'Pontuação',
  'ui.piecesPts': 'Peças',
  'ui.cpuPts': 'CPU',
  'ui.deployPts': 'Deploy',
  'ui.bonusFull': 'Robot completo',
  'ui.bonusL3': 'Peça L3',
  'ui.total': 'Total',
  'ui.phaseWork': 'Fase 1 · workers livres: {n}',
  'ui.phaseMarket': 'Fase 2 · mercado: 1 compra',
  'ui.goMarket': 'Ir ao mercado',
  'ui.endTurn': 'Terminar turno',
  'ui.workFirst': 'Primeiro os workers',
  ...gerado,
};
