// ── Bitnik i18n ───────────────────────────────────────────────────
// Usage: window.T('key') → string in current lang
// Lang stored in localStorage 'lang', default 'pt'
// Trigger lang change: setLang('en') / setLang('pt')

const STRINGS = {
  pt: {
    // Common
    'lang.toggle': 'EN',
    'nav.catalog': '← Catálogo',
    'nav.rules': '? Regras',
    'btn.enter': 'Entrar →',
    'btn.start': 'Iniciar jogo',
    'btn.leave': '← Sair da mesa',
    'btn.restart': 'Jogar de novo',
    'btn.mesas': 'Mesas de jogo',
    'btn.catalog': '← Catálogo',
    'name.placeholder': 'O teu nome…',
    'lobby.empty': '(vazia)',
    'lobby.playing': 'A jogar',
    'lobby.full': 'Cheia',
    'lobby.enter': 'Entrar →',
    'lobby.solo': 'Solo vs 2 Bots',
    'lobby.join.solo': 'Jogar solo →',
    'lobby.wait.host': 'O host inicia o jogo',
    'lobby.wait.min': 'Aguarda {n} jogador(es)',
    'conn.lost': 'A ligar…',
    'error.name': 'Precisas de um nome!',
    'gameover.title': 'Fim de jogo',
    'gameover.winner': 'Vencedor',
    'gameover.only.caps': 'só capivaras',

    // Capivaras
    'cap.title': 'Capivaras',
    'cap.sub': 'Apostas secretas no Pantanal · 2–6 jogadores',
    'cap.phase.betting': 'A Apostar',
    'cap.phase.reveal': 'Revelação',
    'cap.phase.over': 'Fim do Jogo',
    'cap.bet.prompt': 'Clica numa carta para apostar',
    'cap.bet.waiting': 'Apostaste na carta {pos} — a aguardar os outros…',
    'cap.reveal.win': '{n} carta{s} recolhida{s}!',
    'cap.reveal.tie': 'Todos empataram — ninguém ganhou cartas!',
    'cap.bird.none': 'Sem detentor',
    'cap.bird.first': '{name} ganhou o token do pássaro!',
    'cap.bird.steal': '{name} roubou o token de {from}!',
    'cap.bird.tie_first': 'Empate — ninguém ficou com o token.',
    'cap.bird.tie_steal': 'Empate — token mantém-se com o detentor.',
    'cap.scored.empty': 'Ainda vazio',
    'cap.scored.title': 'As tuas cartas',
    'cap.table.title': 'Cartas na Mesa — clica para apostar',
    'cap.pass.first': '1ª passagem',
    'cap.pass.second': '2ª passagem',
    'cap.cards.left': '{n} cartas restantes',
    'cap.bets': '{placed}/{n} apostas',
    'cap.rules.title': 'Regras — Capivaras',
    'cap.rules.video': 'Ver vídeo das regras',

    // Percebes
    'perc.title': 'Praia das Percebes',
    'perc.sub': 'Tile placement na praia · 2–4 jogadores',
    'perc.phase.place': 'Colocar tile',
    'perc.phase.guard': 'Colocar salva-vidas',
    'perc.phase.extra': 'Turno extra',
    'perc.phase.over': 'Fim do Jogo',
    'perc.draw': 'Tiras do baralho:',
    'perc.hand': 'O teu tile:',
    'perc.guards': 'Fichas de salva-vidas:',
    'perc.place.prompt': 'Clica numa célula válida para colocar o tile',
    'perc.guard.prompt': 'Escolhe a direcção do salva-vidas (H ou V)',
    'perc.guard.skip': 'Não colocar salva-vidas',
    'perc.objectives': 'Objectivos',
    'perc.claimed': 'reclamado',
    'perc.board': 'Tabuleiro',
    'perc.deck': '{n} tiles no baralho',
    'perc.scored.title': 'Pontos',
    'perc.tile.normal': 'Banhistas',
    'perc.tile.surf': 'Prancha',
    'perc.tile.rock': 'Rocha',
    'perc.tile.sand': 'Areia',
    'perc.rules.title': 'Regras — Praia das Percebes',
    'perc.rules.video': 'Ver vídeo das regras',
  },

  en: {
    // Common
    'lang.toggle': 'PT',
    'nav.catalog': '← Catalogue',
    'nav.rules': '? Rules',
    'btn.enter': 'Join →',
    'btn.start': 'Start game',
    'btn.leave': '← Leave table',
    'btn.restart': 'Play again',
    'btn.mesas': 'Game tables',
    'btn.catalog': '← Catalogue',
    'name.placeholder': 'Your name…',
    'lobby.empty': '(empty)',
    'lobby.playing': 'Playing',
    'lobby.full': 'Full',
    'lobby.enter': 'Join →',
    'lobby.solo': 'Solo vs 2 Bots',
    'lobby.join.solo': 'Play solo →',
    'lobby.wait.host': 'Host starts the game',
    'lobby.wait.min': 'Waiting for {n} more player(s)',
    'conn.lost': 'Connecting…',
    'error.name': 'You need a name!',
    'gameover.title': 'Game over',
    'gameover.winner': 'Winner',
    'gameover.only.caps': 'capybaras only',

    // Capivaras
    'cap.title': 'Capivaras',
    'cap.sub': 'Secret bets in the Pantanal · 2–6 players',
    'cap.phase.betting': 'Betting',
    'cap.phase.reveal': 'Reveal',
    'cap.phase.over': 'Game Over',
    'cap.bet.prompt': 'Click a card to bet',
    'cap.bet.waiting': 'You bet on card {pos} — waiting for others…',
    'cap.reveal.win': '{n} card{s} collected!',
    'cap.reveal.tie': 'Everyone tied — no cards won!',
    'cap.bird.none': 'No holder',
    'cap.bird.first': '{name} got the bird token!',
    'cap.bird.steal': '{name} stole the token from {from}!',
    'cap.bird.tie_first': 'Tie — nobody got the bird token.',
    'cap.bird.tie_steal': 'Tie — token stays with current holder.',
    'cap.scored.empty': 'Nothing yet',
    'cap.scored.title': 'Your cards',
    'cap.table.title': 'Cards on the table — click to bet',
    'cap.pass.first': '1st pass',
    'cap.pass.second': '2nd pass',
    'cap.cards.left': '{n} cards left',
    'cap.bets': '{placed}/{n} bets',
    'cap.rules.title': 'Rules — Capivaras',
    'cap.rules.video': 'Watch rules video',

    // Percebes (Barnacle Beach)
    'perc.title': 'Barnacle Beach',
    'perc.sub': 'Tile placement on the beach · 2–4 players',
    'perc.phase.place': 'Place tile',
    'perc.phase.guard': 'Place lifeguard',
    'perc.phase.extra': 'Extra turn',
    'perc.phase.over': 'Game Over',
    'perc.draw': 'Drawing from deck:',
    'perc.hand': 'Your tile:',
    'perc.guards': 'Lifeguard tokens:',
    'perc.place.prompt': 'Click a valid cell to place your tile',
    'perc.guard.prompt': 'Choose lifeguard direction (H or V)',
    'perc.guard.skip': 'Skip lifeguard',
    'perc.objectives': 'Objectives',
    'perc.claimed': 'claimed',
    'perc.board': 'Board',
    'perc.deck': '{n} tiles in deck',
    'perc.scored.title': 'Score',
    'perc.tile.normal': 'Bathers',
    'perc.tile.surf': 'Surfboard',
    'perc.tile.rock': 'Rock',
    'perc.tile.sand': 'Sand',
    'perc.rules.title': 'Rules — Barnacle Beach',
    'perc.rules.video': 'Watch rules video',
  }
};

function getLang() {
  return localStorage.getItem('bitnik_lang') || 'pt';
}

function setLang(lang) {
  localStorage.setItem('bitnik_lang', lang);
  document.documentElement.lang = lang;
  // Trigger re-render for elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');
    const val = T(key);
    if (attr) el.setAttribute(attr, val);
    else el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = T(el.getAttribute('data-i18n-ph'));
  });
  // Dispatch so game clients can re-render
  window.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
}

function T(key, vars) {
  const lang = getLang();
  let str = (STRINGS[lang] || STRINGS.pt)[key] || (STRINGS.pt)[key] || key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, v);
    });
  }
  return str;
}

function toggleLang() {
  setLang(getLang() === 'pt' ? 'en' : 'pt');
}
