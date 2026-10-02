// Texto da modal "Como se joga" (botão ? durante a partida) — condensado a
// partir do REGRAS.md, nas duas línguas. Não é lido pelas regras (rules.js):
// é só conteúdo de UI, mostrado pela plataforma (app.js). Pode aparecer antes
// de entrar na mesa (lobby), por isso o `visual` usa estilo inline, sem
// depender do capivaras.css, e caminhos absolutos para as imagens do pacote.
const IMG = '/games/capivaras/ui';
const LILY = { Y: '#f2c14e', R: '#e0533d', W: '#f4f1ea', B: '#3a8fd6' };
const ring = 'box-shadow:0 0 0 1px rgb(0 0 0 / .3);';

const lily = (c, size = 14) => `<i style="display:inline-block;width:${size}px;height:${size}px;border-radius:50%;background:${LILY[c]};${ring}"></i>`;
const card = (file, w = 54) => `<img src="${IMG}/cartas/${file}.webp" alt="" style="display:block;width:${w}px;aspect-ratio:2/3;object-fit:cover;border-radius:7px;box-shadow:0 2px 6px rgb(0 0 0 / .3);">`;
const bird = (size = 18) => `<img src="${IMG}/passaro.webp" alt="" width="${size}" height="${size}" style="display:inline-block;">`;
// Uma carta com a letra por cima e uma legenda por baixo (e, opcionalmente, um selo).
const slot = (file, letra, legenda, selo = '', dim = false) => `<div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;font-size:12px;text-align:center;max-width:92px;${dim ? 'opacity:.55;' : ''}">
  <div style="position:relative;">${card(file)}${letra ? `<b style="position:absolute;left:-5px;top:-5px;min-width:19px;height:19px;border-radius:50%;background:#fff;color:#333;display:grid;place-items:center;font-size:11px;box-shadow:0 1px 3px rgb(0 0 0 / .4);">${letra}</b>` : ''}${selo}</div>
  <span>${legenda}</span>
</div>`;
const selo = (txt, bg) => `<b style="position:absolute;right:-6px;bottom:-6px;padding:1px 6px;border-radius:99px;background:${bg};color:#fff;font-size:11px;box-shadow:0 1px 3px rgb(0 0 0 / .4);">${txt}</b>`;
const row = (inner) => `<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;justify-content:center;margin:12px 0 4px;">${inner}</div>`;
const chip = (inner) => `<span class="rules-chip">${inner}</span>`;

// A mesa de uma ronda a 3 jogadores: cartas A, B, C.
const mesa = (nota) => row(`${slot('cap5_bird', 'A', '5')}${slot('cap2_Y', 'B', '2')}${slot('cap3', 'C', '3')}`) + `<div class="rules-note" style="text-align:center;">${nota}</div>`;
// Um exemplo de apostas: duas em A (fogem), uma em B (ganha), nenhuma em C.
const apostas = (l) => row(`${slot('cap5_bird', 'A', l.a, selo('✕', '#c0392b'), true)}${slot('cap2_Y', 'B', l.b, selo('✓', '#2e8b57'))}${slot('cap3', 'C', l.c, '', true)}`);
const passaro = (l) => row(`${slot('cap2_bird', '', l.carta)}<div style="align-self:center;display:flex;flex-direction:column;gap:6px;">${chip(`${bird(20)} ${l.token}`)}${chip(`<b>+5</b> ${l.fim}`)}</div>`);
const nenufares = (l) => row(`<div style="display:flex;flex-direction:column;gap:8px;align-items:center;">
  <div style="display:flex;gap:8px;">${['Y', 'R', 'W', 'B'].map((c) => lily(c, 22)).join('')}</div>
  <div style="font-size:12px;">${l.cores}</div></div>
  <div style="align-self:center;font-size:20px;">→</div>
  <div style="align-self:center;">${chip(`<b>+10</b> ${l.fim}`)}</div>`)
  + row(`${slot('cap2_Y', '', l.amarelo)}${slot('cap1_R', '', l.vermelho)}${slot('cap1_BW', '', l.azulBranco)}`);
const pontos = (l) => `<div class="rules-visual" style="justify-content:center;">
  ${chip(`<b>1</b> ${l.cap}`)}${chip(`${bird(18)} <b>+5</b>`)}${chip(`${lily('Y', 11)}${lily('R', 11)}${lily('W', 11)}${lily('B', 11)} <b>+10</b>`)}</div>`;
const deck = (l) => `<div class="rules-visual" style="justify-content:center;">${chip(`<b>1</b> ${l.volta1}`)}<span>→</span>${chip(`<b>2</b> ${l.volta2}`)}<span>→</span>${chip(l.fim)}</div>`;

export default {
  pt: [
    { title: 'Objetivo', body: [
      'Termina o jogo com mais pontos do que os outros. Os pontos vêm das capivaras que apanhas, do token do pássaro e do bónus dos nenúfares.',
      'A cada ronda são colocadas na mesa tantas cartas quantos os jogadores, viradas para cima.',
    ], visual: mesa('3 jogadores = 3 cartas · cada carta tem a sua letra') },
    { title: 'Apostar', body: [
      'Em segredo, cada jogador escolhe uma das cartas da mesa. Ninguém vê a escolha dos outros até todos terem decidido; depois de apostar, não podes mudar.',
      'As apostas revelam-se todas ao mesmo tempo. Se foste o único a escolher essa carta, é tua; se mais do que um jogador escolheu a mesma, ninguém a ganha — as capivaras fugiram.',
      'Apostar sempre na carta de maior valor nem sempre compensa: se for óbvia, outro jogador pode escolher a mesma.',
    ], visual: apostas({ a: '2 apostas: fogem', b: '1 aposta: é tua', c: 'sem apostas' }) },
    { title: 'Token do pássaro', body: [
      'A primeira vez que alguém apanha uma carta com pássaro, fica com o token. Para lho roubar, precisas de acumular mais cartas com pássaro do que quem o tem — empatar não chega.',
      'Quem tiver o token no final do jogo ganha +5 pontos.',
    ], visual: passaro({ carta: 'Carta com pássaro', token: 'Token do pássaro', fim: 'no fim do jogo' }) },
    { title: 'Bónus dos nenúfares', body: [
      'Algumas cartas têm nenúfares de 4 cores (Amarelo, Vermelho, Branco, Azul). Reunir as 4 cores entre as cartas que apanhaste ao longo do jogo (não precisam de estar na mesma carta) dá +10 pontos no final.',
    ], visual: nenufares({ cores: 'As 4 cores', fim: 'no fim do jogo', amarelo: 'Amarelo', vermelho: 'Vermelho', azulBranco: 'Azul + branco' }) },
    { title: 'Fim de jogo e pontuação', body: [
      'O baralho joga-se duas vezes: quando as cartas acabam a primeira vez, o descarte é baralhado e reutilizado; à segunda vez que acabam, o jogo termina.',
      'Pontuação final: 1 ponto por capivara nas cartas apanhadas, +5 pelo token do pássaro, +10 pelas 4 cores de nenúfar. Ganha quem tiver mais pontos; empate no máximo partilha a vitória.',
    ], visual: pontos({ cap: 'por capivara' }) + deck({ volta1: 'volta ao baralho', volta2: 'volta ao baralho', fim: 'Fim' }) },
  ],
  en: [
    { title: 'Objective', body: [
      'Finish the game with more points than everyone else. Points come from the capybaras you catch, the bird token, and the lily bonus.',
      'Each round, as many cards as there are players are placed on the table, face up.',
    ], visual: mesa('3 players = 3 cards · each card has its own letter') },
    { title: 'Betting', body: [
      'In secret, each player picks one of the table cards. No one sees anyone else\'s pick until everyone has decided; once you bet, you can\'t change it.',
      'All bets are revealed at the same time. If you were the only one to pick that card, it\'s yours; if more than one player picked the same card, no one gets it — the capybaras ran off.',
      'Always betting on the highest-value card doesn\'t always pay off: if it\'s the obvious choice, someone else may pick it too.',
    ], visual: apostas({ a: '2 bets: they run off', b: '1 bet: you get it', c: 'no bets' }) },
    { title: 'Bird token', body: [
      'The first time someone catches a card with a bird, they get the token. To steal it, you need to have caught more bird cards than the current holder — a tie isn\'t enough.',
      'Whoever holds the token at the end of the game gets +5 points.',
    ], visual: passaro({ carta: 'Card with a bird', token: 'Bird token', fim: 'at the end of the game' }) },
    { title: 'Lily bonus', body: [
      'Some cards have lilies in 4 colors (Yellow, Red, White, Blue). Collecting all 4 colors across the cards you\'ve caught over the game (not necessarily on the same card) gives +10 points at the end.',
    ], visual: nenufares({ cores: 'All 4 colors', fim: 'at the end of the game', amarelo: 'Yellow', vermelho: 'Red', azulBranco: 'Blue + white' }) },
    { title: 'End of game and scoring', body: [
      'The deck is played twice through: when the cards run out the first time, the discard pile is reshuffled and reused; the second time it runs out, the game ends.',
      'Final score: 1 point per capybara on caught cards, +5 for the bird token, +10 for the 4 lily colors. Highest score wins; a tie at the top shares the win.',
    ], visual: pontos({ cap: 'per capybara' }) + deck({ volta1: 'pass through the deck', volta2: 'pass through the deck', fim: 'End' }) },
  ],
};
