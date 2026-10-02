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
  // Tutorial (ui/tutorial.js)
  'tut.you': 'Tu',
  'tut.bot': 'Bot',
  'tut.welcome.title': 'Robot Maker',
  'tut.welcome.body': 'Cada engenheiro constrói um robot: 5 peças (cabeça, peito, braço, porta e pernas) mais uma CPU. Em cada turno pões os teus workers no tabuleiro e depois fazes uma compra no mercado. Quem completa um robot a sério dispara o fim do jogo; ganha quem tiver mais pontos.',
  'tut.board.title': 'O tabuleiro',
  'tut.board.body': 'Quatro ações, um worker por ação. Compilador: +3 L1 (ilimitado). Optimizador: 2×L1 viram 1×L2 (ilimitado). Forja: uma peça L1 grátis, num slot vazio do robot (só um jogador por ronda). Deploy: +6 pontos (só um jogador por ronda).',
  'tut.work.title': 'Fase 1: os workers',
  'tut.work.body': 'Tens 1 worker e, para a lição, 2 L1. Carrega na Forja e escolhe uma peça L1 grátis: como é exclusiva, convém tirá-la antes de o bot lá chegar. Podes escolher a que quiseres.',
  'tut.market.title': 'Fase 2: o mercado',
  'tut.market.body': 'Depois dos workers, uma compra no mercado, sem gastar worker, que acaba o turno. As peças sobem de nível uma a uma: L1 num slot vazio, L2 sobre L1, L3 sobre L2 (a CPU também). Compra uma peça L1 que consigas pagar (2×L1) ou termina o turno.',
  'tut.bots.title': 'O adversário joga',
  'tut.bots.body': 'O bot faz o turno dele. No fim da ronda o tabuleiro liberta-se, a ordem roda e o mercado também: a peça mais à esquerda de cada nível, se ninguém a adquiriu, vai para o fundo do baralho e entra outra.',
  'tut.round2.title': 'Uma nova ronda',
  'tut.round2.body': 'O bot jogou primeiro (a ordem roda). Faz agora uma ação: o Compilador dá-te L1 para comprar, o Optimizador transforma-os em L2 (precisas deles para as peças de nível 2) e o Deploy dá 6 pontos já.',
  'tut.circuits.title': 'Os circuitos',
  'tut.circuits.body': 'Cada circuito é um bónus: quem tiver primeiro as três peças indicadas ganha um worker extra (máximo 3 workers; um circuito por jogador) e esse circuito esgota-se para todos. Pela Forja o worker novo joga logo; por compra, só na ronda seguinte.',
  'tut.mine.title': 'O teu robot',
  'tut.mine.body': 'Aqui vês o teu robot e a estimativa de pontos. A CPU multiplica os pontos das peças nas suas zonas (consoante a família e o nível); robot completo dá +8 e ter uma peça L3 dá +5. Os Deploys somam-se.',
  'tut.end.title': 'O fim do jogo',
  'tut.end.body': 'Quando alguém tem as 6 peças, com pelo menos 1 L3 e 3 de nível 2 ou mais, dispara o fim: essa pessoa já não joga, a ronda acaba e joga-se mais uma só com os outros. Ganha quem tiver mais pontos (empate: mais peças L3).',
  'tut.tips.title': 'Estás pronto',
  'tut.tips.body': 'Dica: não ignores o Deploy (+6 pontos garantidos) nem os circuitos (workers a mais valem muito). Boa sorte!',
};
