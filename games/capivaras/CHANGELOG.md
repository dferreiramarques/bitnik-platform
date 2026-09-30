# Capivaras — histórico de regras

## 2.0.4 — Regras numa modal; barra de apostas simplificada; fade nos jogadores (2026-09-30)

Ganha o botão "?" com as regras do jogo numa modal (`ui/rules-text.js`, PT
e EN), como o Catania.

Sem mudanças de jogo, no resto: a barra de estado, durante as apostas,
passa a dizer sempre só "Apostas X / Y" — antes tinha 3 textos diferentes
consoante o estado (a ver, à espera, a escolher), com alturas diferentes,
que faziam a interface subir e descer; agora usa o mesmo formato e altura
da barra de revelação. No layout horizontal (telemóvel/tablet deitado),
os cartões dos jogadores ganham um fade nas pontas de cima e de baixo, a
sugerir que há mais para ver com scroll — com o máximo de jogadores só
davam para ver os primeiros 3.

## 2.0.3 — Cor do registo volta ao texto da mesa (2026-09-29)

Sem mudanças de jogo: o registo deixa de ser branco fixo e volta a usar
`--game-on-table-muted`, a mesma cor dos outros textos secundários sobre a
mesa.

## 2.0.2 — Registo mais discreto; começa fechado (2026-09-29)

Sem mudanças de jogo: o texto do registo passa a branco, fino e pequeno,
sem sombra — um log discreto. Deixa de ter scroll (o conteúdo mais antigo
corta, não se vê). Começa sempre fechado.

## 2.0.1 — Registo cresce até meio ecrã (2026-09-29)

Sem mudanças de jogo: o registo passa a crescer com o conteúdo até 50% da
altura do ecrã e só a partir daí desliza, em vez de cortar nas últimas 4
entradas (mesmo comportamento em todos os jogos, `design/figma/TEMPLATE.md`).

## 2.0.0 — Baralho do jogo e UI própria (2026-09-27)

**Baralho igual ao do jogo.** O baralho da 1.0.0 foi gerado na Forge: tinha a mesma distribuição de capivaras (6, 13, 11, 4 e 2), mas os pássaros e os nenúfares eram inventados.
- Passa a ter as 36 cartas do jogo original, as mesmas da arte. A lista está em REGRAS.md.
- Há 10 cartas com pássaro.
- Há nenúfares Amarelos em 4 cartas, Vermelhos em 3, Azuis em 4 e Brancos em 2.
- Muda o conteúdo das partidas, por isso a versão é major: as partidas solo da 1.x ficam expiradas.

**UI própria no template (ADR-014):**
- mesa em ecrã inteiro com as cartas ilustradas no centro;
- jogadores em vidro, com pássaros e nenúfares;
- a minha coleção com as cores que faltam para o bónus;
- a revelação mostra quem apostou em cada carta.

Vitórias por lugar em simulação com bots (1000 partidas), com o baralho novo:

| Jogadores | Vitórias por lugar (%) |
|---|---|
| 2 | 53,8 / 46,3 |
| 3 | 34,3 / 32,3 / 33,5 |
| 4 | 25,8 / 25,5 / 25,0 / 23,8 |
| 5 | 18,2 / 19,8 / 20,3 / 19,3 / 22,4 |
| 6 | 18,4 / 18,1 / 15,4 / 17,0 / 16,4 / 14,7 |

Não há vantagem de lugar. A 2 jogadores, os 53,8 / 46,3 eram ruído: em 3 × 3000 partidas deu 48,4 / 51,6, 50,0 / 50,0 e 51,4 / 48,7.

## 1.0.0 — Publicado (2026-09-26)

Publicado a partir da Forge (regras 0.1.0, 20 testes aprovados).

**Empate: partilham a vitória** (decisão na publicação; antes ganhava o primeiro lugar empatado, o que dava ~3 pontos a mais ao 1.º lugar a 3 e 4 jogadores).

A UI genérica mostra, no bloco de cada jogador, os pontos atuais, os pássaros (🐦(n)) e as cores de nenúfar apanhadas, e cada aposta diz o que a carta vale.

Vitórias por lugar em simulação com bots (2000 partidas):

| Jogadores | Vitórias por lugar (%) |
|---|---|
| 2 | 49,7 / 50,3 |
| 3 | 33,7 / 34,2 / 32,1 |
| 4 | 25,2 / 25,2 / 25,0 / 24,6 |
| 5 | 19,7 / 18,7 / 19,8 / 21,3 / 20,6 |
| 6 | 15,6 / 17,3 / 16,6 / 17,1 / 16,7 / 16,8 |

## Protótipos

- 0.1.0: teste do commit
