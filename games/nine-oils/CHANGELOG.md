# Nine Oils — histórico de regras

## 1.1.11 — Regras numa modal; banca numa só linha; X do descarte dentro da carta (2026-09-30)

Ganha o botão "?" com as regras do jogo numa modal (`ui/rules-text.js`, PT
e EN), como o Catania — não existia nenhum atalho de regras até aqui.

Sem mudanças de jogo, no resto: as 6 casas da banca deixam de partir em
2 linhas no telemóvel (encolhem o suficiente para caberem sempre numa só).
Removidos "{pontos}/6" e "Reserva: {n}" do cartão do jogador — informação
repetida com as próprias casas da banca. O X de descarte passa para
dentro dos limites da carta (estava a sair pelo canto). Acrescenta um
layout horizontal (telemóvel/tablet deitado) com os jogadores à esquerda,
como as Capivaras.

## 1.1.10 — Cor do registo volta ao texto da mesa (2026-09-29)

Sem mudanças de jogo: o registo deixa de ser branco fixo e volta a usar
`--game-on-table-muted`, a mesma cor dos outros textos secundários sobre a
mesa.

## 1.1.9 — Registo mais discreto; começa fechado (2026-09-29)

Sem mudanças de jogo: o texto do registo passa a branco, fino e pequeno,
sem sombra — um log discreto. Deixa de ter scroll (o conteúdo mais antigo
corta, não se vê). Começa sempre fechado.

## 1.1.8 — Registo cresce até meio ecrã (2026-09-29)

Sem mudanças de jogo: o registo passa a crescer com o conteúdo até 50% da
altura do ecrã e só a partir daí desliza, em vez de cortar nas últimas 5
entradas (mesmo comportamento em todos os jogos, `design/figma/TEMPLATE.md`).

## 1.1.7 — X de descarte no canto da carta (2026-09-28)

Sem mudanças de jogo: no descarte, a carta em si continua a abrir os
detalhes ao clicar, mas ganha um X vermelho no canto superior — é esse X,
não a barra de jogadas, que descarta a carta.

## 1.1.6 — A mão mostra a arte, em dobro, sem o botão "?" (2026-09-28)

Sem mudanças de jogo:

- As cartas da mão mostram a arte original (não o emoji), no dobro do
  tamanho de antes (a jogar continua a sair da barra de jogadas).
- O botão "?" desaparece: clicar na própria carta abre sempre os detalhes
  (a jogada de a descartar, antes só ao clicar na carta, passa a estar na
  barra de jogadas como as outras, para não conflituar com o clique).
- O modal de detalhes já não corta a imagem: painel mais largo e a arte
  em `object-fit: contain`.

## 1.1.5 — Emoji, dados animados e sem pausa manual (2026-09-28)

Sem mudanças de jogo:

- Emoji trocados a pedido do David: Sedutora ❤️‍🔥 (era 💃), Rapaz 👦🏽 (era
  🤏), Valentão 💪🏼 (era 👊), garrafa da banca 🧪 (era 🍾). `describeMove` no
  `rules.js` também mudou, por isso a UI genérica de qualquer prototípo
  futuro herda os novos emoji automaticamente.
- Dados como pintas num dado a sério (grelha 3×3), com uma leve animação de
  entrada e cores alternadas, em vez de números a preto e branco.
- A pausa "ver os dados" (fase PAUSA, jogada Continuar) deixa de pedir um
  clique: a UI própria manda a jogada sozinha meio segundo depois de
  mostrar os dados. A jogada Continuar continua a existir no contrato
  (para o replay e para a UI genérica), só deixou de aparecer como botão.
- O modal de detalhes da carta (1.1.3) mostra a arte a ocupar toda a
  altura do modal, não só uma faixa estreita.

## 1.1.4 — Arte das cartas no modal de detalhes (2026-09-28)

Sem mudanças de jogo: o modal de detalhes (1.1.3) passa a mostrar a arte
ilustrada de cada carta (`ui/cartas/{boy,bully,temptress}.jpg`, fornecida
pelo David), em vez do emoji. O emoji continua como recuo automático se a
imagem não carregar.

## 1.1.3 — Detalhes da carta (2026-09-28)

Sem mudanças de jogo: cada carta da mão ganha um botão "?" que abre os
detalhes (quando jogar, efeito completo e a frase de sabor), tal como no
jogo online antigo (nineoils.up.railway.app). O texto vem do `REGRAS.md`;
a arte (`ui/cartas/*.png`) ainda não estava no pacote — sem ela, o modal
mostrava o emoji da carta em grande.

## 1.1.2 — UI própria, no template vanilla (2026-09-28)

Sem mudanças de jogo: primeira UI própria do Nine Oils (ADR-006), sem tokens
próprios (`ui/skin.json` é uma cópia de `design/vanilla/skin.json`), para
mostrar a clientes o aspeto de base da plataforma. Banca de 6 casas por
jogador, mão com os mesmos emoji do registo (💃🤏👊), dados do lançamento e
escolha às cegas como cartas viradas para baixo. Deixa de usar a UI genérica
de protótipo.

## 1.1.1 — Mensagem da mesa no Penta (2026-09-28)

Sem mudanças de jogo: o Penta (5 dados iguais, ~5% dos lançamentos; o adversário descarta a mão toda) passa a aparecer também como mensagem da mesa ("Penta!"), não só uma linha no registo, que mantém a frase completa (`ctx.log('log.PENTA', {}, { announce: { variant: 'warn', key: 'msg.PENTA' } })`, ADR-014). O Nove (vitória instantânea) não ganhou mensagem: coincide sempre com o resultado, que já mostra o vencedor.

## 1.1.0 — 2 Rapazes (2026-09-26)

- **2 Rapazes** (8 cartas de Personagem), como nas regras escritas. Simulação com 20 000 partidas por versão: quem começa ganha 53,1% com 2 Rapazes e 53,7% com 3; há metade dos roubos (0,36 contra 0,76 por partida). Não desequilibra.
- Na escolha de combinações, as melhores (as que nenhuma outra opção contém) aparecem primeiro e com ★.

## 1.0.0 — Migração para a plataforma (2026-09-26)

Regras migradas do servidor antigo (repositório `nineoils-v2`, `server.js`, v1.4), sem mudanças de jogo. `REGRAS.md` é a edição portuguesa do README antigo. Bot igual ao antigo (joga Sedutoras ou um Rapaz, escolhe a melhor combinação, bloqueia sempre que pode, nunca usa 2 Valentões para atacar).

Para rever:

- O baralho do jogo antigo tinha 3 Rapazes (resolvido na 1.1.0: 2).
- Quando um lançamento dá várias opções, a lista inclui também conjuntos com menos combinações (resolvido na 1.1.0: as melhores com ★).
- A pausa depois de lançar (para os dois verem os dados) é uma jogada, "Continuar" (resolvido na UI, 1.1.5: a mesa avança sozinha ~1s depois de mostrar os dados, sem botão manual).

Vitórias por lugar em simulação com bots (1000 partidas, quem começa é sorteado): 48,8 / 51,2.

Por fazer: UI própria (por agora usa a UI genérica de protótipo).
