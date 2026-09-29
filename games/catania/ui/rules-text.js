// Texto da modal "Como se joga" (botão ? durante a partida) — condensado a
// partir do REGRAS.md, nas duas línguas. Não é lido pelas regras (rules.js):
// é só conteúdo de UI, mostrado pela plataforma (app.js). O campo opcional
// `visual` é HTML de confiança (deste pacote, não de jogadores) que mostra os
// componentes reais do jogo — os mesmos ícones e o mesmo disco/ficha de
// aldeia da mesa — para complementar o texto.
import { ICONS } from './icons.js';

const chip = (key, label) => `<span class="rules-chip"><img src="${ICONS[key]}" width="18" height="18" alt="">${label}</span>`;

const RES_PT = { cereais: 'Cereais', vinho: 'Vinho', peixe: 'Peixe', calcario: 'Calcário', azeite: 'Azeite' };
const RES_EN = { cereais: 'Grain', vinho: 'Wine', peixe: 'Fish', calcario: 'Stone', azeite: 'Olive' };
const resRow = (labels) => `<div class="rules-visual">${Object.entries(labels).map(([k, l]) => chip(k, l)).join('')}</div>`;

const discRow = `<div class="rules-visual">
  <span class="cat-disc">9</span><span class="rules-note">→</span><span class="cat-disc">7</span><span class="rules-note">→</span><span class="cat-disc red">3</span>
</div>`;

const villRow = (note) => `<div class="rules-visual">
  <span class="cat-vill" style="border-left-color:var(--cat-res-cereais)">${chipImg('cereais')}×5</span>
  <span class="rules-note">${note}</span>
</div>`;
function chipImg(key) { return `<img src="${ICONS[key]}" width="14" height="14" alt="">`; }

export default {
  pt: [
    { title: 'Objetivo', body: [
      'Cada jogador funda aldeias e gere os recursos da ilha. Ganha quem tiver as aldeias mais valiosas no fim do jogo.',
      'A ilha tem territórios de 5 recursos. Cada recurso tem uma pilha de discos: o disco de cima é o valor atual desse recurso.',
    ], visual: resRow(RES_PT) },
    { title: 'O turno', body: [
      'Em cada turno, recolhes em até 2 territórios diferentes: 1 carta (o valor não muda) ou 2 cartas (tiras o disco do topo da torre para a pilha desse recurso — passa a ser o novo valor).',
      'Não podes recolher no território do Fogo do Etna, nem duas vezes no mesmo território, nem onde já está um trabalhador de outro jogador.',
      'Sempre que sai um disco vermelho, o Etna entra em erupção: move o Fogo do Etna para um território vizinho vazio.',
    ] },
    { title: 'Fundar uma aldeia', body: [
      'Depois de recolher, com pelo menos 5 cartas de 2 tipos diferentes, podes fundar uma aldeia (a última ação do turno).',
      'O tipo com mais cartas fica na aldeia (maioria) e conta para a pontuação; os outros tipos são descartados (minorias).',
      'Podes valorizar uma das minorias descartadas: o disco de cima dessa pilha volta à torre e o valor volta ao disco anterior.',
    ], visual: villRow('assim fica a aldeia no teu cartão') },
    { title: 'Torre e pilhas', body: [
      'A torre está sempre ordenada, do disco mais baixo ao mais alto; recolher 2 cartas tira sempre o disco mais alto disponível.',
      'Os valores tendem a descer ao longo do jogo, mas recolher 2 pode fazer um valor subir, se um disco maior tiver voltado à torre entretanto. Um disco vermelho provoca uma erupção.',
    ], visual: discRow },
    { title: 'Fim do jogo e pontuação', body: [
      'Quando alguém funda a 3.ª aldeia, joga-se até ao fim dessa ronda (todos jogam o mesmo número de turnos).',
      'Cada aldeia vale cartas × valor atual do recurso. Ganha quem tiver mais pontos; em caso de empate, quem tiver mais cartas na mão; se persistir, a vitória é partilhada.',
    ] },
  ],
  en: [
    { title: 'Objective', body: [
      'Each player founds villages and manages the island’s resources. Whoever has the most valuable villages at the end wins.',
      'The island has territories of 5 resources. Each resource has a stack of discs: the top disc is that resource’s current value.',
    ], visual: resRow(RES_EN) },
    { title: 'Your turn', body: [
      'Each turn, collect in up to 2 different territories: 1 card (the value doesn’t change) or 2 cards (take the top disc from the tower onto that resource’s stack — it becomes the new value).',
      'You cannot collect on the Etna Fire’s territory, twice on the same territory, or where another player already has a worker.',
      'Whenever a red disc comes out, Etna erupts: move the Etna Fire to an empty neighbouring territory.',
    ] },
    { title: 'Founding a village', body: [
      'After collecting, with at least 5 cards of 2 different types, you may found a village (the last action of the turn).',
      'The type you have the most of stays in the village (majority) and counts for scoring; the other types are discarded (minorities).',
      'You may upgrade one of the discarded minorities: that stack’s top disc returns to the tower and the value goes back to the previous disc.',
    ], visual: villRow('this is how the village looks on your card') },
    { title: 'Tower and stacks', body: [
      'The tower is always sorted, lowest disc at the bottom to highest at the top; collecting 2 cards always takes the highest disc available.',
      'Values tend to drop over the game, but collecting 2 can raise a value if a higher disc was returned to the tower in the meantime. A red disc triggers an eruption.',
    ], visual: discRow },
    { title: 'End of game and scoring', body: [
      'When someone founds their 3rd village, the game continues until the end of that round (everyone plays the same number of turns).',
      'Each village is worth cards × the resource’s current value. Highest score wins; ties go to whoever has more cards in hand; if still tied, the win is shared.',
    ] },
  ],
};
