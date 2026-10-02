// English texts. Part keys are generated (28 parts).
const SLOTS = ['head', 'chest', 'arm', 'port', 'legs'];
const FAMILIAS = ['bio', 'combat', 'agility', 'shield'];
const SLOT = { head: 'Head', chest: 'Torso', arm: 'Arm', port: 'Interface', legs: 'Legs', cpu: 'CPU' };
const PECA = {
  head: ['Basic Head', 'Sensor Head', 'AI Head'],
  chest: ['Light Torso', 'Armored Torso', 'Adaptive Torso'],
  arm: ['Simple Arm', 'Laser Arm', 'Plasma Arm'],
  port: ['Serial Port', 'Data Port', 'Quantum Antenna'],
  legs: ['Standard Legs', 'Turbo Legs', 'Gravity Legs'],
};
const CPU = { bio: 'Bio-Core', combat: 'Combat Core', agility: 'Agility Core', shield: 'Shield Core', omni: 'Omni Core' };
const CIRCUITO = { central: 'Central', combate: 'Combat', mobilidade: 'Mobility', armas: 'Weapons', processo: 'Process' };

const nome = {};
for (const s of SLOTS) [1, 2, 3].forEach((n) => { nome[s + n] = `${PECA[s][n - 1]} (L${n})`; });
for (const f of FAMILIAS) [1, 2, 3].forEach((n) => { nome[f + n] = `${CPU[f]} L${n}`; });
nome.omni3 = 'Omni Core L3';

const gerado = {};
for (const [id, n] of Object.entries(nome)) {
  gerado[`peca.${id}`] = n;
  gerado[`moveLabel.COMPRAR.${id}`] = `Buy ${n}`;
  gerado[`log.COMPRAR.${id}`] = `bought ${n}`;
}
for (const s of SLOTS) {
  gerado[`moveLabel.FORJA.${s}`] = `Forge: ${PECA[s][0]}`;
  gerado[`log.FORJA.${s}1`] = `used the Forge and got ${PECA[s][0]}`;
}
for (const s of [...SLOTS, 'cpu']) gerado[`slot.${s}`] = SLOT[s];
for (const [id, n] of Object.entries(CIRCUITO)) {
  gerado[`circuito.${id}`] = `${n} Circuit`;
  gerado[`log.CIRCUITO.${id}`] = `completed the ${n} Circuit: gains a worker`;
}
for (const [f, n] of Object.entries(CPU)) gerado[`cpu.${f}`] = n;

export default {
  'game.name': 'Robot Maker',
  'game.tagline': 'Build the most efficient robot with workers, blocks and circuits.',
  'move.COMPILADOR': 'Compiler: +3 L1',
  'move.OPTIMIZADOR': 'Optimizer: 2×L1 → 1×L2',
  'move.FORJA': 'Forge: free L1 part',
  'move.DEPLOY': 'Deploy: +6 points',
  'move.COMPRAR': 'Buy a part',
  'move.PASSAR': 'Pass',
  'move.IR_AO_MERCADO': 'Go to the market',
  'err.FASE': 'Workers on the board first; then the market.',
  'log.IR_AO_MERCADO': 'went to the market',
  'err.SEM_WORKERS': 'You have no free workers.',
  'err.SLOT_OCUPADO': 'That slot is already taken this round.',
  'err.RECURSOS': "You don't have enough blocks.",
  'err.SEM_STOCK': 'That part is sold out.',
  'err.NAO_VISIVEL': "That part isn't on display in the market.",
  'err.NIVEL': 'You can only go up one level at a time: L1 on an empty slot, L2 on L1, L3 on L2.',
  'err.PECA_INVALIDA': 'Invalid part for this move.',
  'log.COMPILADOR': 'used the Compiler: +3 L1',
  'log.OPTIMIZADOR': 'used the Optimizer: 2×L1 → 1×L2',
  'log.OPTIMIZADOR_VAZIO': 'used the Optimizer without 2×L1: the worker was spent for nothing',
  'log.FORJA_VAZIA': 'used the Forge with no empty slot: the worker was spent for nothing',
  'log.DEPLOY': 'deployed: +{n} points',
  'log.PASSAR': 'passed',
  'log.GATILHO': 'Robot complete! The game ends after one more round without this player.',
  'log.RONDA_EXTRA': 'Last round!',
  'log.FIM': 'The game is over.',
  'log.RONDA': 'Round {n}',
  'log.ROTACAO': 'Nobody got level {nivel} parts: the market rotates.',
  'ui.round': 'Round {n}',
  'ui.roundOf': 'Round {n}/{max}',
  'ui.finalRound': 'Last round!',
  'ui.sitsOut': '{nome} is out',
  'ui.yourTurn': 'Your turn',
  'ui.turnOf': "{nome}'s turn",
  'ui.workers': 'Workers',
  'ui.free': 'free',
  'ui.points': 'points',
  'ui.estimate': 'Points now',
  'ui.board': 'Board',
  'ui.slot.compilador': 'Compiler',
  'ui.slot.optimizador': 'Optimizer',
  'ui.slot.forja': 'Forge',
  'ui.slot.deploy': 'Deploy',
  'ui.fx.compilador': '+3 L1 per worker',
  'ui.fx.optimizador': '2×L1 → 1×L2',
  'ui.fx.forja': '1 free L1 part',
  'ui.fx.deploy': '+6 points',
  'ui.unlimited': 'unlimited',
  'ui.exclusive': 'exclusive',
  'ui.market': 'Market',
  'ui.level': 'Level {n}',
  'ui.cpus': 'CPUs',
  'ui.deck': 'deck: {n}',
  'ui.myRobot': 'My robot',
  'ui.robotOf': "{nome}'s robot",
  'ui.empty': 'empty',
  'ui.pass': 'Pass',
  'ui.cancel': 'Cancel',
  'ui.pickSlot': 'Forge: pick the free L1 part',
  'ui.circuits': 'Circuits',
  'ui.circuitFree': 'free',
  'ui.circuitTaken': 'taken',
  'ui.needs': 'Missing: {falta}',
  'ui.log': 'Log',
  'ui.panel': 'Market and circuits',
  'ui.spectating': 'Watching the game.',
  'ui.waiting': 'Waiting for {nome}…',
  'ui.cost': 'Cost',
  'ui.breakdown': 'Score',
  'ui.piecesPts': 'Parts',
  'ui.cpuPts': 'CPU',
  'ui.deployPts': 'Deploy',
  'ui.bonusFull': 'Complete robot',
  'ui.bonusL3': 'L3 part',
  'ui.total': 'Total',
  'ui.phaseWork': 'Phase 1 · free workers: {n}',
  'ui.phaseMarket': 'Phase 2 · market: 1 purchase',
  'ui.goMarket': 'Go to the market',
  'ui.endTurn': 'End turn',
  'ui.workFirst': 'Workers first',
  ...gerado,
};
