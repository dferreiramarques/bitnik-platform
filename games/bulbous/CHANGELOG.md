# Bulbous — histórico de regras

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
