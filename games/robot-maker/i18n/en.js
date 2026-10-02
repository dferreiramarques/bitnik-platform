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
  // Tutorial (ui/tutorial.js)
  'tut.you': 'You',
  'tut.bot': 'Bot',
  'tut.welcome.title': 'Robot Maker',
  'tut.welcome.body': 'Each engineer builds a robot: 5 parts (head, chest, arm, port and legs) plus a CPU. Every turn you place your workers on the board and then make one purchase from the market. Whoever completes a real robot triggers the end of the game; most points wins.',
  'tut.board.title': 'The board',
  'tut.board.body': 'Four actions, one worker per action. Compiler: +3 L1 (unlimited). Optimizer: 2×L1 become 1×L2 (unlimited). Forge: a free L1 part, in an empty robot slot (one player per round). Deploy: +6 points (one player per round).',
  'tut.work.title': 'Phase 1: workers',
  'tut.work.body': 'You have 1 worker and, for the lesson, 2 L1. Press the Forge and pick a free L1 part: it is exclusive, so grab it before the bot gets there. Pick whichever you like.',
  'tut.market.title': 'Phase 2: the market',
  'tut.market.body': 'After the workers, one purchase from the market, which costs no worker and ends the turn. Parts go up one level at a time: L1 in an empty slot, L2 over L1, L3 over L2 (the CPU too). Buy an L1 part you can afford (2×L1) or end the turn.',
  'tut.bots.title': 'The opponent plays',
  'tut.bots.body': 'The bot takes its turn. At the end of the round the board clears, the order rotates and so does the market: the leftmost part of each level, if nobody acquired it, goes to the bottom of the deck and another comes in.',
  'tut.round2.title': 'A new round',
  'tut.round2.body': 'The bot went first (the order rotates). Now take an action: the Compiler gives you L1 to spend, the Optimizer turns them into L2 (you need those for level-2 parts) and Deploy gives 6 points right away.',
  'tut.circuits.title': 'The circuits',
  'tut.circuits.body': 'Each circuit is a bonus: whoever first has the three parts shown gets an extra worker (3 workers at most; one circuit per player) and that circuit is used up for everyone. Via the Forge the new worker plays at once; by purchase, only next round.',
  'tut.mine.title': 'Your robot',
  'tut.mine.body': 'Here you see your robot and your estimated points. The CPU multiplies the points of the parts in its zones (depending on family and level); a complete robot gives +8 and having an L3 part gives +5. Deploys add up.',
  'tut.end.title': 'The end of the game',
  'tut.end.body': 'When someone has all 6 parts, with at least 1 L3 and 3 of level 2 or higher, the end is triggered: that player no longer plays, the round finishes and one more is played with the others only. Most points wins (tie: more L3 parts).',
  'tut.tips.title': 'You are ready',
  'tut.tips.body': 'Tip: do not ignore Deploy (+6 guaranteed points) or the circuits (extra workers are worth a lot). Good luck!',
};
