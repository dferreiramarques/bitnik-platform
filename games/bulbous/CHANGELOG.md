# Bulbous — histórico de regras

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
