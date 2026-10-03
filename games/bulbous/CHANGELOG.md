# Bulbous — histórico de regras

## 1.2.1 — Baelfungious completas (2026-10-03)

Sem mudanças de regras. Quando há Baelfungious completas, aparece uma pill "Completas (N)" no cartão do jogador e na minha zona; abre um modal com scroll com essas cartas e os bolbos que cada uma leva.

## 1.2.0 — Tutorial interativo (2026-10-02)

Sem mudanças de regras: o jogo ganha um tutorial interativo ("Tutorial", ao lado de "Como se joga", no lobby). Joga-se a 2, contra o bot, com o motor verdadeiro no browser: escolher as Baelfungious, declarar a sequência da ronda como Governante e apostar na 1.ª vaza; o Joker, o ×2, as rondas e a pontuação explicam-se em texto. A mão do jogador é a da lição (números altos nas suas duas cores, um ×2 e o Joker). Usa o guia de passos e a partida local da plataforma (`ctx.tour`, `ctx.session`, ADR-018).


## 1.1.15 — Registo flutuante a sério (2026-10-01)

Sem mudanças de jogo: o registo estava dentro da linha de baixo e, ao
abrir, empurrava a minha zona de Baelfungious — não flutuava a sério,
apesar de já estar documentado assim no `design/figma/TEMPLATE.md`.
Passa a sobrepor-se (canto inferior esquerdo) sem afetar o resto do
ecrã.

## 1.1.14 — Fundo do lobby e miniatura, finalmente separados (2026-10-01)

O campo `cover` (1.1.13) tentava servir dois fins ao mesmo tempo: fundo
do lobby e miniatura na página da marca. Problema: o fundo do lobby
devia ser sempre a mesa a sério (`--table-bg`, com as afinações da
consola já aplicadas), não uma imagem estática no contrato. Separa os
dois:

- O fundo do lobby deixa de depender de um campo — é sempre o
  `--table-bg` do jogo, escurecido (app.css), o mesmo que pinta a mesa
  em jogo.
- `cover` passa a `thumbnail`: só a miniatura da página da marca, sem
  nenhuma ligação ao lobby. Volta a ser a foto da carta
  (baelf_red_4.webp, como antes da 1.1.13), que resulta melhor como
  miniatura do que como fundo.

## 1.1.13 — Capa do lobby uniformizada com os outros jogos (2026-10-01)

Sem mudanças de jogo. A capa do lobby deixa de ser a foto de uma carta
(baelf_red_4.webp) e passa a ser o mesmo gradiente e textura do fundo
da mesa em jogo (`--table-bg` do skin.json) — como o Catania, a Praia
das Percebes, o Nine Oils e as Capivaras, para os lobbies terem todos
o mesmo tipo de fundo (uma cor/textura discreta, não uma foto).

## 1.1.12 — Crachá da sequência dentro do próprio cartão (2026-09-30)

Sem mudanças de jogo. O número (1, 2, 3, 4) sobre cada Baelfungious
ativa vivia num `<span>` irmão do cartão, dentro de um wrapper só para
isso — sem z-index próprio, dependia da ordem no HTML para ficar por
cima. Passa a ser filho direto do cartão, com z-index acima da arte e
dos bolbos: não pode ficar escondido por um cartão vizinho, seja qual
for o estado de transform/:hover de qualquer um (o suspeito mais
provável do que ainda se via no telemóvel depois da correção 1.1.11).

## 1.1.11 — Números da sequência já não desapareciam a meio (2026-09-30)

No telemóvel, ao declarar a sequência, escolher a 2ª Baelfungious podia
apagar o número da 1ª (o Governante perdia o que já tinha escolhido a
meio da declaração). Causa: uma reconexão de rede breve (comum em
mobile — ecrã bloqueia, muda de wifi para dados) marca o jogador
"away" e volta no instante a seguir, o que manda um novo estado a
todos; a sequência em construção estava a ser limpa nessa atualização,
mesmo sem ter mudado de ronda. Agora só é limpa quando muda mesmo de
ronda (quando há mesmo uma sequência nova para declarar).

## 1.1.10 — Sequência declarada, visível na mesa (2026-09-30)

A UI própria do Bulbous (desde a 1.1.0) nunca ligou as entradas do
registo marcadas para aparecer como mensagem da mesa (`ctx.announce`,
ADR-014) — a UI genérica faz isso sozinha, mas uma UI própria tem de o
fazer explicitamente, e faltava aqui. Na prática, isto significa que a
sequência declarada pelo Governante (e também o "Última ronda!", já
existente mas nunca visível) não aparecia a ninguém como mensagem na
mesa, só no registo (fechado por omissão). Agora "Sequência
declarada!" aparece a todos assim que o Governante confirma — a ordem
em si já se via (e continua a ver-se) nos números sobre cada
Baelfungious ativa, durante toda a ronda.

## 1.1.9 — Jogadores mais compactos na horizontal (2026-09-30)

Sem mudanças de jogo. No layout horizontal (telemóvel deitado), a
coluna dos jogadores podia ficar mais alta do que o espaço disponível
com os 4 jogadores — precisava de scroll e escondia os últimos. Os
cartões dos jogadores ficam mais compactos (menos preenchimento, letra
mais pequena) para caberem sempre os 4 inteiros, mesmo no telemóvel
mais baixo (~300px de altura) e com o máximo de Baelfungious por
jogador.

## 1.1.8 — Barra de ações já não tapa a mão (2026-09-30)

Sem mudanças de jogo. Desde que a mão deixou de quebrar linha (1.1.7),
a barra de ações (Apostar/Trocar/Passar) — que flutuava por cima da
mão para não gastar espaço — passou a tapar a maior parte de todos os
cartões, em vez de só os de uma eventual 2ª linha. Passa a ter linha
própria, por baixo da mão (continua a colapsar a zero quando não há
ações).

## 1.1.7 — Mão nunca quebra linha (2026-09-30)

Sem mudanças de jogo. As cartas da mão passam a sobrepor-se (em vez de
passar para uma 2ª linha) quando não cabem todas lado a lado no espaço
disponível — o espaçamento normal só encolhe até se tornar sobreposição
(nunca menos de 16px visíveis por cartão), recalculado sempre que o
espaço muda (rodar o telemóvel, painéis que aparecem/somem).

## 1.1.6 — Ações numa coluna na horizontal; coroa como crachá (2026-09-30)

Sem mudanças de jogo. No layout horizontal (telemóvel/tablet deitado),
os botões de ação passam de uma barra flutuante por cima da mão para
uma coluna à direita — há largura de sobra nesse layout e a mão fica
livre. No layout vertical mantém-se a barra flutuante (feita na versão
anterior).

A coroa do governante deixa de ir dentro da linha do nome (podia
sobrepor-se-lhe em nomes compridos ou cartões estreitos) — passa a um
crachá no canto do cartão, sem tirar espaço a mais nada.

## 1.1.5 — Jogadores sempre visíveis; ações sem texto; barra flutuante (2026-09-30)

Sem mudanças de jogo. No telemóvel na vertical, os cartões dos
jogadores deixam de ter largura fixa: dividem a linha em partes iguais
(a 2 jogadores, o dobro da largura de a 4) e ficam sempre todos
visíveis, sem scroll — só 2 ou 4 jogadores, por isso cabem sempre.

Os botões de ação deixam de ter texto explicativo por cima (ex.:
"Escolhe cartas da mesma cor…") — só a ação em si. A barra de ações
passa a flutuar por cima da mão, em vez de ocupar uma linha própria
(tal como os controlos de zoom de outros jogos), tanto no layout
vertical como no horizontal.

## 1.1.4 — Jogadores em faixa; mesa numa linha; layout horizontal (2026-09-30)

Sem mudanças de jogo. No telemóvel na vertical: os jogadores passam a
uma faixa com scroll horizontal, como as Capivaras (antes eram uma
grelha 2×2). As Baelfungious ativas (até 4, a "mesa") encolhem o
suficiente para caberem sempre numa só linha, sem quebrar. Acrescenta
um layout horizontal (telemóvel/tablet deitado), como o Catania:
jogadores à esquerda, área de jogo à direita, mão e barra de ações em
baixo — não existia nenhum até aqui.

## 1.1.3 — Imagem do lobby (2026-09-29)

Sem mudanças de jogo: acrescenta `cover` ao contrato (uma das artes das
cartas), usada como fundo escurecido do lobby na plataforma.

## 1.1.2 — Arte a sério do jogo antigo (2026-09-29)

Sem mudanças de jogo: as 50 imagens do jogo antigo (repositório `bulbous`,
`public/cards/*.webp` — 16 Baelfungious, uma por cor×espécime, e 34
cartas de charme, uma por cor×valor mais os 2 Jokers) passam a fazer
parte do pacote (`ui/cards/`), trazidas tal como estavam. Os bolbos já
colocados numa Baelfungious desenham-se por cima da própria arte, nas
posições exatas medidas no jogo antigo (`SLOT_POS`), na cor de quem os
colocou — os anéis vazios já estão desenhados na imagem, não precisam de
nada por cima. O cartão a CSS (símbolo/emoji + valor) da versão anterior
fica só como recuo, se alguma imagem faltar.

## 1.1.1 — Fichas da ronda por baixo dos jogadores (2026-09-29)

Sem mudanças de jogo: a ficha "Ronda N · M no baralho" estava ao lado dos
cartões dos jogadores (linha `.bulbous-topline` em flex-row); passa a
ficar sempre numa linha própria, centrada, por baixo deles — como no
Catania e no Capivaras. `design/figma/TEMPLATE.md` tornado explícito
sobre esta regra (secção 3): fichas de ronda/vez/baralho nunca ao lado
dos jogadores, mesmo quando cabem.

## 1.1.0 — UI própria, no template vanilla (2026-09-29)

Sem mudanças de jogo: primeira UI própria do Bulbous (ADR-006), no
template vanilla da plataforma (jogadores em vidro, registo flutuante,
sem tabuleiro). Paleta e proporções das cartas seguem 1:1 o jogo antigo
(repositório `bulbous`, `client.html`): fundo quase-preto, roxo brilhante
em destaque, as 4 cores de bolbo (vermelho, azul, verde, amarelo) e as
cartas de charme com símbolo (▲ triângulo / ● círculo) + valor, tal como
no original — essas continuam desenhadas só a CSS, sem imagens, como já
estavam lá. As Baelfungious (sem arte publicada ainda) seguem a convenção
de componentes reutilizáveis do `CONTRATO.md` (`--card-baelf-<cor>-<espécime>`),
com um emoji de recuo por espécime (🌱🍄🧌👑) até haver imagem.

Interação: escolher uma Baelfungious é um clique direto; declarar a
sequência da ronda é tocar as 4 Baelfungious ativas pela ordem (o
Governante); apostar/trocar/descartar selecionam cartas da mão e
confirmam num botão — constroem a jogada diretamente (não percorrem
`msg.legal`, que para Apostar listaria um botão por cada subconjunto
possível da mão). O desempate mostra só as cartas da cor certa.

## 1.0.2 — Mensagem da última ronda mais curta (2026-09-28)

A frase completa do registo ("trouxe a última Baelfungious: o jogo acaba no fim desta ronda") ficava grande de mais como mensagem ao centro da mesa, em duas linhas, a tapar o painel de jogadas. Passa a ter um texto próprio, mais curto, só para a mesa: "Última ronda!" (nova chave `msg.ULTIMA`), com `ctx.log('log.ULTIMA', {}, { announce: { variant: 'warn', key: 'msg.ULTIMA' } })`. O registo mantém a frase completa.

## 1.0.1 — Mensagem da mesa na última ronda (2026-09-28)

Sem mudanças de jogo: quem traz a última Baelfungious à mesa (fim ativado) passa a aparecer também como mensagem da mesa, em vez de só uma linha no registo (`ctx.log('log.ULTIMA', {}, { announce: 'warn' })`, ADR-014).

## 1.0.0 — Migração para a plataforma (2026-09-25)

Regras migradas do servidor antigo (repositório `bulbous`, `game.js`), sem mudanças de jogo:

- Modos: 2 jogadores, 4 individual e 4 em equipas (2 contra 2, `options.equipas`). A 3 não se joga (`players.counts: [2, 4]`).
- O desempate continua com 20 segundos para os empatados jogarem uma carta; agora é um temporizador do motor (`FIM_DESEMPATE`).
- Bots iguais aos antigos (mesmas estratégias e probabilidades), agora com o gerador de números da partida.

Diferenças técnicas (não mudam o jogo):

- O valor de uma aposta com Joker é 1000 em vez de infinito, para o estado ser JSON.
- Se num fim de ronda já não houver nenhuma Baelfungious ativa, o jogo acaba (no servidor antigo ficava parado).

Vitórias por lugar em simulação com bots (300 partidas):

| Jogadores | Vitórias por lugar (%) |
|---|---|
| 2 | 50,2 / 49,8 |
| 4 | 25,3 / 24,7 / 25,2 / 24,8 |

Por fazer: escolher o modo de equipas no lobby; UI própria (por agora usa a UI genérica de protótipo).
