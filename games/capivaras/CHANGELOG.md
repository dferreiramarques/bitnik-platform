# Capivaras — histórico de regras

## 2.1.2 — Telemóvel na horizontal: containers trocados (2026-10-03)

Sem mudanças de regras. Na horizontal, a barra de apostas/revelação passa para baixo da coluna dos jogadores e as cartas apanhadas para baixo das cartas da mesa; a coluna dos jogadores só tem fade em baixo.

## 2.1.1 — Regras ilustradas e tutorial mais claro (2026-10-02)

Sem mudanças de regras. A modal "Como se joga" passa a ter o tema do Capivaras também no lobby (antes só o tinha dentro da mesa) e ganha ilustrações com as cartas reais: a mesa de uma ronda, um exemplo de apostas (duas na A, a carta foge; uma na B, é tua), o token do pássaro, as quatro cores de nenúfar e a pontuação. No tutorial, o passo da aposta (e qualquer passo que espere por uma jogada) passa a dizer "Faz a jogada na mesa para continuar", porque não tem botão "Seguinte" e parecia bloqueado no passo 3.

## 2.1.0 — Tutorial interativo (2026-10-02)

Sem mudanças de regras: o jogo ganha um tutorial interativo ("Tutorial", ao lado de "Como se joga", no lobby). Joga-se uma ronda a sério contra dois bots, com o motor verdadeiro no browser: as cartas da mesa, a aposta em segredo, a revelação (a carta mais valiosa foge, porque os dois bots apostam nela), a pontuação, os nenúfares, o token do pássaro e as duas voltas ao baralho. Usa o guia de passos e a partida local da plataforma (`ctx.tour`, `ctx.session`, ADR-018).


## 2.0.8 — Registo flutuante a sério (2026-10-01)

Sem mudanças de jogo: o registo estava dentro da linha de baixo e, ao
abrir, empurrava a minha área — não flutuava a sério, apesar de já
estar documentado assim no `design/figma/TEMPLATE.md`. Passa a
sobrepor-se (canto inferior esquerdo) sem afetar o resto do ecrã.

## 2.0.7 — Fundo do lobby sem precisar de campo (2026-10-01)

Sem mudanças de jogo: o `cover` da 2.0.6 era uma imagem estática a
tentar imitar o fundo da mesa — sai do contrato outra vez. O fundo do
lobby passa a ser sempre o `--table-bg` do jogo, escurecido (igual ao
Catania e aos outros jogos), automaticamente, sem nenhum campo — o que
inclui afinações da consola (ex.: um fundo "customizado" desta mesa),
ao contrário de uma imagem estática do pacote.

## 2.0.6 — Imagem do lobby (2026-10-01)

Sem mudanças de jogo: acrescenta `cover` ao contrato — o mesmo
gradiente do fundo da mesa em jogo (`--table-bg` do skin.json), usado
como fundo escurecido do lobby na plataforma e miniatura na página da
marca, como o Catania já tinha.

## 2.0.5 — Modal das regras ao estilo do jogo (2026-09-30)

Sem mudanças de jogo: a modal "Como se joga" usava as cores genéricas da
plataforma. Passa a usar a moldura clara e o texto das cartas do próprio
jogo, com os títulos a dourado — como as cartas de capivaras na mesa.

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
