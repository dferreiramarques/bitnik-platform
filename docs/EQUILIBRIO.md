# Equilíbrio entre lugares

Regras que dão vantagem a um lugar à mesa, por jogo. Números de simulação com bots (vitórias por lugar, em %). Os bots são simples: o que está marcado "a confirmar" deve ser visto em mesas de aprovação com jogadores reais antes de mexer nas regras.

Atualizado a 2026-09-29.

## Catania (5.0.0)

| Jogadores | Vitórias por lugar |
|---|---|
| 2 | 50,3 / 49,7 |
| 3 | 33,4 / 33,6 / 33,0 |
| 4 | 24,7 / 24,9 / 24,0 / 26,4 |

- **Quem começa** tinha vantagem. **Resolvido na 4.0.0**: no 1.º turno, a 2.ª recolha do 1.º jogador é de 1 carta. Com as pilhas da 5.0.0 continua a fazer falta (sem ela, 52,3% a 2 jogadores); a 3 jogadores já não sobra vantagem. Os números atuais (50,3/49,7 a 2; 33/33/33 a 3; 24-26% a 4) já não mostram vantagem de lugar que se destaque do ruído da simulação. **Fechado (2026-09-29)**: sem mais ação; só voltar ao assunto se mesas de aprovação reais mostrarem outra coisa.
- **Recurso "esquecido" cai a pique** (não é de lugar, mas decide partidas): uma pilha em que ninguém mexeu fica alta e, quando alguém recolhe 2, recebe o disco do topo da torre, que no fim do jogo é baixo (ex.: 11 → 3). Desde a 5.0.0, valorizar esse recurso desfaz a queda (o 3 volta à torre e o valor volta a 11) — dá uma saída a quem ficou com o disco baixo. **Fechado (2026-09-29): intencional**, fica como está.

## Praia das Percebes (2.0.0)

| Jogadores | Vitórias por lugar |
|---|---|
| 2 | 46,4 / 53,6 |
| 3 | 29,7 / 39,1 / 31,2 |
| 4 | 28,6 / 28,4 / 20,2 / 22,8 |

- **Paridade das linhas**: a mesa começa com 1 peça e as peças põem-se à vez, por isso quem completa as linhas de comprimento ímpar é quase sempre o mesmo lugar. Na 1.0 o 2.º jogador ganhava 2/3 das partidas a 2. **Resolvido na 2.0.0**: colunas de 4 e 6 (as linhas ficam 5 e 7).
- **Salva-vidas cedo**: a 3 e 4 jogadores, os primeiros lugares vigiam primeiro as linhas que vão crescer (a 4, o 3.º lugar faz ~35 pontos com salva-vidas contra ~40 do 1.º). Compensações testadas (fichas a mais, baralho igual para todos, sem salva-vidas na 1.ª volta) não resolvem a 4; "sem salva-vidas na 1.ª volta" deixa os 3 jogadores justos (33 / 33 / 34) mas piora os 4. **Decidido não mexer**: a intenção do jogo é que cada jogador controle a sua vantagem e anule a dos outros (ex.: tapar com uma rocha a linha vigiada por outro, ou não a esticar); os bots não fazem isso. Confirmar em mesas com jogadores reais.
- **Número de peças**: o jogo acaba quando o baralho tem menos peças do que jogadores, por isso o 1.º lugar põe mais uma peça do que os outros (a 3: 14 / 13 / 13; a 4: 11 / 10 / 10 / 10). Efeito pequeno.

## Nine Oils (1.1.0)

| Jogadores | Vitórias por lugar |
|---|---|
| 2 | 50,2 / 49,8 (quem começa é sorteado) |

- **Quem começa** ganha ~53-54% (corrida às 6 garrafas: quem lança primeiro chega primeiro). Igual com 2 ou 3 Rapazes. Testadas duas compensações por cartas (2.ª carta para quem não começa; 0 cartas para quem começa) em 12 000 partidas cada: nenhuma desloca mais de ~1 ponto percentual, dentro do ruído da simulação — a vantagem vem de jogar primeiro na corrida, não do número de cartas na mão. **Decidido não mexer** (2026-09-29): é elegante manter a simetria, cada jogador começa com 1 carta.

## Bulbous (1.0.0)

| Jogadores | Vitórias por lugar |
|---|---|
| 2 | 50,2 / 49,8 |
| 4 | 25,3 / 24,7 / 25,2 / 24,8 |

- Sem vantagem de lugar. O Governante roda todas as rondas.

## Capivaras (1.0.0)

| Jogadores | Vitórias por lugar |
|---|---|
| 2 | 49,7 / 50,3 |
| 3 | 33,7 / 34,2 / 32,1 |
| 4 | 25,2 / 25,2 / 25,0 / 24,6 |
| 5 | 19,7 / 18,7 / 19,8 / 21,3 / 20,6 |
| 6 | 15,6 / 17,3 / 16,6 / 17,1 / 16,7 / 16,8 |

- **Empates davam a vitória ao lugar mais baixo** (o 1.º lugar tinha 35,5% a 3 jogadores). **Resolvido na 1.0.0**: um empate partilha a vitória.
- As apostas são simultâneas: não há vantagem de lugar.

## Startup Panic (1.0.0)

| Jogadores | Vitórias por lugar (1000 partidas, bot do pacote) | Referência do jogo original |
|---|---|---|
| 2 | 47,2 / 52,8 | 52 / 48 |
| 3 | 32,1 / 34,0 / 33,8 | 36 / 33 / 31 |
| 4 | 23,7 / 24,8 / 26,5 / 25,1 | 26 / 26 / 24 / 25 |

- O "lugar" é o do assento, não a ordem de jogo (que muda a cada ronda). Tudo dentro do ruído da simulação (~±1,5 pontos), exceto o desvio do 2 jogadores, que sai invertido.
- A referência vem de um simulador que não está no repositório. A diferença provável é a correção da 0.2.0: comprar e vender no Gate no mesmo turno dava lucro sem limite e o `spBot` original nunca a exerceu.
- O bot só compra, vende no Gate e contrata Engenheiros Estagiários: não contrata Séniores nem propõe trocas.

## Startup Panic (2.0.0)

| Jogadores | Vitórias por lugar (1000 partidas, bot do pacote) |
|---|---|
| 2 | 49,3 / 50,7 |
| 3 | 32,6 / 33,0 / 34,5 |
| 4 | 24,4 / 26,7 / 24,7 / 24,2 |

- Mais equilibrado do que a 1.0.0 (sem vantagem de lugar). O bot agora também contrata Advogado e CFO. Partidas mais longas: ~163, 186 e 211 jogadas por partida (2, 3 e 4 jogadores).
- **O que a simulação não mede:** se o jogo é mais divertido. Observado a jogar: os bots esgotam a pool partilhada de trabalhadores já na ronda 1 (4+3+2 de 12), o que é um ponto a rever no assessment (pool maior, ou limite por ronda).

## Startup Panic (3.0.0)

| Jogadores | Vitórias por lugar (1000 partidas, bot do pacote) |
|---|---|
| 2 | 50,1 / 49,9 |
| 3 | 33,5 / 33,1 / 33,4 |
| 4 | 25,1 / 25,3 / 24,9 / 24,8 |

- Sem vantagem de lugar. Partidas mais curtas em jogadas (56, 85 e 112 por partida a 2, 3 e 4 jogadores): o limite de 9 ações faz o bot parar de comprar.
- **O que a simulação não mede:** se o jogo ficou mais divertido, nem se a economia (dividendos até ×4, salários até 3M) está bem calibrada para humanos. Assessment pendente com partidas reais.

## Startup Panic (3.4.0) — corrige as secções anteriores desde a 3.0.0

**As tabelas da 3.0.0 (50/50, 33/33/33, 25/25/25/25) não valem:** nessa versão os bots ficavam parados (0M, sem equipa, 12 pts cada) e, sendo todos iguais, davam 25% a cada lugar sem jogarem. Corrigido na 3.4.0 (ver `CHANGELOG.md`). Com os bots a jogar a sério (1000 partidas por configuração, pontuação em 200):

| Jogadores | Vitórias por lugar | Pontos: mediana / p90 / máximo |
|---|---|---|
| 2 | 49,5 / 50,5 | 610 / 1868 / 3631 |
| 3 | 33,9 / 32,3 / 33,9 | 411 / 1773 / 5499 |
| 4 | 26,4 / 22,7 / 24,3 / 26,7 | 338 / 1400 / 5181 |

- Sem vantagem de lugar relevante (dentro do ruído).
- **A economia está inflacionada.** O valor final varia de dezenas a milhares de pontos (p90 ≈ 1400–1900, máximo > 5000). Vem dos dividendos até ×4 com 9 ações e do Gate final ×20. O "final apoteótico" é intencional, mas a escala de níveis ×1–×4 da 3.0.0 multiplicou-o; a rever no assessment (por exemplo, ×1 / ×1,5 / ×2 / ×3, ou menos ações por startup nos Gates).

