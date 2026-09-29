# Praia das Percebes — histórico de regras

## 2.0.13 — Objetivos à altura dos jogadores; baralho centrado (2026-09-29)

Sem mudanças de jogo:

- O painel dos objetivos passa a esticar até à mesma altura dos cartões
  dos jogadores no ecrã (`align-items: stretch` na linha, em vez de
  `center`), no lugar de ficar mais baixo.
- A pill do baralho ("N de TOTAL no baralho") sai de dentro do bloco dos
  objetivos e fica centrada no ecrã, numa linha própria por baixo dos
  jogadores/objetivos.
- No telemóvel, os objetivos ficam mais pequenos e discretos (texto e
  ícones menores, menos padding e sombra), para não competirem com os
  cartões dos jogadores.

## 2.0.12 — Jogadores e objetivos numa linha; sem registo no telemóvel (2026-09-29)

Sem mudanças de jogo:

- Jogadores e objetivos passam a partilhar uma só linha, em vez de duas
  (`.praia-topline`).
- No telemóvel (largura até 760px): os jogadores ficam 2 a 2, os objetivos
  numa linha por baixo, e o registo de jogadas fica escondido (cabe pouco e
  a peça a colocar já diz o essencial).
- Corrigido (visual, sem relação com o pedido acima): o comentário no topo
  do ficheiro CSS tinha `--card-*/--token-*`, e o `*/` a meio fechava o
  comentário mais cedo do que devia — o resto do ficheiro, incluindo o
  `*/` a sério, ficava a fazer parte de uma única regra inválida que
  engolia a primeira regra a seguir (`.praia`, a que dá posição e
  `container-type` a tudo). Só nalgumas larguras (por acaso, as de
  telemóvel) é que isso se notava.

## 2.0.11 — Peças restantes no baralho (2026-09-29)

Sem mudanças de jogo: uma pill por baixo dos objetivos mostra quantas
peças faltam no baralho ("N de TOTAL no baralho").

## 2.0.10 — Vento a branco (2026-09-29)

Sem mudanças de jogo: o ícone do vento passa a branco (era o texto sobre
a mesa, azul-marinho).

## 2.0.9 — Vento mais subtil (2026-09-29)

Sem mudanças de jogo: opacidade do vento entre 10% e 30% (era 40%-55%),
mais discreto.

## 2.0.8 — Corrigido: o zoom já centra no rato (2026-09-29)

Sem mudanças de jogo: o zoom (roda, pinça, botões) derivava para a
esquerda em vez de ficar centrado onde o rato/dedo está. A grelha do
tabuleiro fica centrada na zona livre (para as casas ficarem sempre
quadradas), e essa zona raramente tem a mesma proporção da grelha — a
matemática do zoom usava o canto da zona livre como referência, não o
canto onde a grelha começa mesmo (`anchor`, na roda do rato, na pinça de
dois dedos e nos botões +/−/ver tudo).

## 2.0.7 — Cartões dos jogadores e objetivos como a barra de jogadas (2026-09-29)

Sem mudanças de jogo: os cartões dos jogadores e o painel dos objetivos
ganham o mesmo arredondamento e sombra suave da barra de jogadas (que já
tinha esse aspeto), para os três lerem como a mesma família de vidro.

## 2.0.6 — Ícone do vento, vidro branco, zoom no canto (2026-09-29)

Sem mudanças de jogo:

- Vento com um ícone a sério (svgrepo.com), em vez de uma faixa simples.
- Vidro dos painéis passa a branco (era azul-ciano), para se ver bem o
  contorno de cada um contra o fundo.
- Os botões de zoom/arrastar ficam sempre fixos no canto inferior direito
  da mesa (antes só a partir de 900px de largura, e escondidos no
  telemóvel).

## 2.0.5 — Pontuação ao vivo e painéis com mais contraste (2026-09-29)

Sem mudanças de jogo:

- `view()` passa a dar a pontuação atual de cada jogador (salva-vidas com
  o tabuleiro de agora + fichas por usar + objetivos), não só no fim — dá
  o mesmo valor final, só que ao vivo. A UI própria mostra-a junto do nome,
  como o Catania.
- Vidro dos painéis (jogadores, objetivos, registo) em azul-ciano, para se
  destacar do fundo em vez de se confundir com ele.
- Painel dos objetivos passa a ser um só bloco com contorno (em vez de
  cada carta separada), texto maior e mais legível.
- Jogador ativo com contorno próprio, mais forte que antes.
- O ecrã de fim de jogo (plataforma, `app.css`) passa a usar os tokens do
  próprio jogo (`--game-panel`, `--game-accent`, …) em vez das cores fixas
  da marca — todos os jogos com UI própria ganham isto, não só a Praia.

## 2.0.4 — Zoom, vento e cartões de objetivo (2026-09-28)

Sem mudanças de jogo, tudo ao estilo do Catania:

- Jogadores em cartões de vidro de largura fixa, como no Catania.
- Tabuleiro com zoom e arrastar (dois dedos, roda do rato, botões +/−/ver
  tudo) — a mesma técnica do Catania (`.pdp-view`/`.pdp-zoom`, zona livre
  medida e um gesto nunca conta como clique numa casa).
- Vento na praia: faixas a passar, decorativas, atrás de tudo (equivalente
  às ondas do Catania, mas sem precisar do relógio contínuo — a camada não
  é regenerada a cada estado, por isso nunca reinicia).
- Objetivos revelados passam a cartões com o nome (ex. "Coluna de 4"), não
  só o ícone e os pontos.

## 2.0.3 — Mesa em degradê de céu/areal (2026-09-28)

Sem mudanças de jogo: o skin.json da Praia deixa de ser uma cópia exata do
vanilla — mesa em degradê de céu para areal e painéis de vidro claro (em
vez de escuro), a inspirar-se no jogo online antigo
(praiadaspercebes.up.railway.app). Só os tokens da mesa mudam (fundo,
vidro, texto sobre a mesa); base, jogadores e forma continuam iguais ao
vanilla. `design/vanilla/skin.json` não foi tocado.

## 2.0.2 — UI própria, no template vanilla (2026-09-28)

Sem mudanças de jogo: primeira UI própria da Praia (ADR-006). Tabuleiro a
sério (clicar numa casa livre coloca a peça, em vez de uma lista de
jogadas), objetivos revelados sempre visíveis, salva-vidas marcados na
peça (↔ ou ↕). As peças, as cartas de objetivo e o marcador do
salva-vidas seguem a convenção de componentes reutilizáveis do
`CONTRATO.md` (`--card-<tipo>`, `--token-salvavidas`); sem arte publicada
ainda, mostram um emoji — a consola Aparência já deixa fazer upload de
cada um assim que houver imagem, sem precisar de código novo. Deixa de
usar a UI genérica de protótipo.

## 2.0.1 — Mensagem da mesa ao cumprir um objetivo (2026-09-28)

Sem mudanças de jogo: conquistar um objetivo revelado (só 8 no baralho) passa a aparecer também como mensagem da mesa ("Objetivo cumprido!"), não só uma linha no registo — que mantém a frase com o nome do objetivo e os pontos (`ctx.log('log.OBJETIVO', ..., { announce: { key: 'msg.OBJETIVO' } })`, ADR-014). O fim do jogo (`log.FIM`) não ganhou mensagem: coincide sempre com o resultado, que já mostra o vencedor.

## 2.0.0 — Colunas de 4 e 6; troços contados sempre da mesma maneira (2026-09-26)

**Os objetivos "Coluna de 5" e "Coluna de 7" passam a "Coluna de 4" e "Coluna de 6"** (mesmos pontos: 4 e 6). As linhas ficam 5 e 7.

Porquê: a mesa começa com 1 peça e os jogadores põem peças à vez, por isso quem põe a 5.ª e a 7.ª peça de uma linha é quase sempre o mesmo lugar. A 2 jogadores o 2.º ficava com 85–94% das linhas e colunas de 5 e 7 e ganhava 2/3 das partidas, mesmo com bots que evitam deixar linhas a meio. Com comprimentos ímpares nas linhas e pares nas colunas, os objetivos repartem-se.

Variantes testadas (2000 partidas, bots atentos aos objetivos; vitórias por lugar em %):

| Regra | 2 jogadores | 3 jogadores | 4 jogadores |
|---|---|---|---|
| 1.0 (linhas e colunas de 5 e 7) | 35 / 65 | 45 / 22 / 33 | 22 / 40 / 16 / 22 |
| Sem peça inicial | 67 / 33 | 38 / 42 / 19 | 31 / 21 / 35 / 13 |
| Tudo par (4 e 6) | 63 / 37 | 20 / 44 / 35 | 33 / 27 / 23 / 17 |
| **Linhas 5 e 7, colunas 4 e 6** | **52 / 48** | **31 / 36 / 34** | **25 / 31 / 27 / 18** |

Com os bots de sempre (2000 partidas): 2 jogadores 46,4 / 53,6; 3 jogadores 29,7 / 39,1 / 31,2; 4 jogadores 28,6 / 28,4 / 20,2 / 22,8. A 4 jogadores o 3.º e o 4.º lugares ainda ficam abaixo (os primeiros vigiam primeiro as linhas que crescem). Compensações simples testadas não resolvem: decidido confirmar em mesas de aprovação com jogadores reais antes de mexer (ver `docs/EQUILIBRIO.md`).

**Salva-vidas:** o troço acaba num buraco ou numa rocha e as pranchas do troço multiplicam sempre (antes, numa linha com buracos não multiplicavam). Sai o código do caso especial do jogo antigo.

## 1.0.1 — Posições legíveis (2026-09-26)

Sem mudança de regras. As posições das jogadas leem-se a partir da peça inicial: C (cima), B (baixo), D (direita), E (esquerda) e o número de casas. Ex.: "C1" logo acima da peça inicial, "C1 D2" uma acima e duas à direita.

## 1.0.0 — Migração para a plataforma (2026-09-26)

Regras migradas do servidor antigo (repositório `praiadaspercebes`, `server.js`), sem mudanças de jogo. `REGRAS.md` escrito a partir das regras do jogo online antigo. Bots iguais aos antigos.

As "voltas extra" quando um jogador fica sem fichas existiam no código antigo mas nunca eram usadas: não passaram.

Vitórias por lugar em simulação com bots (300 partidas):

| Jogadores | Vitórias por lugar (%) |
|---|---|
| 2 | 34,3 / **65,7** |
| 3 | 37,3 / 31,5 / 31,2 |
| 4 | 22,6 / 34,1 / 14,7 / 28,6 |

**A 2 jogadores o 2.º lugar ganha dois terços das partidas**, e a 4 há diferenças grandes entre lugares. Os bots são simples: confirmar numa mesa de aprovação antes de mexer nas regras.

Por fazer: UI própria (por agora usa a UI genérica de protótipo, que mostra as posições como coordenadas).
