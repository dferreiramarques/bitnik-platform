# Equilíbrio entre lugares

Regras que dão vantagem a um lugar à mesa, por jogo. Números de simulação com bots (vitórias por lugar, em %). Os bots são simples: o que está marcado "a confirmar" deve ser visto em mesas de aprovação com jogadores reais antes de mexer nas regras.

Atualizado a 2026-09-26.

## Catania (4.0.1)

| Jogadores | Vitórias por lugar |
|---|---|
| 2 | 50,5 / 49,5 |
| 3 | 34,7 / 32,3 / 33,0 |
| 4 | 25,9 / 25,3 / 23,4 / 25,5 |

- **Quem começa** tinha vantagem. **Resolvido na 4.0.0**: no 1.º turno, a 2.ª recolha do 1.º jogador é de 1 carta. A 3 jogadores sobra +1,4 pontos para o 1.º lugar. *A confirmar.*
- **Recurso "esquecido" cai a pique** (não é de lugar, mas decide partidas): uma pilha em que ninguém mexeu fica alta e, quando alguém recolhe 2, recebe o disco do topo da torre, que no fim do jogo é baixo (ex.: 11 → 3). Desde a 4.0.1 a UI mostra o próximo disco. *A confirmar se é intencional.*

## Praia das Percebes (2.0.0)

| Jogadores | Vitórias por lugar |
|---|---|
| 2 | 46,4 / 53,6 |
| 3 | 29,7 / 39,1 / 31,2 |
| 4 | 28,6 / 28,4 / 20,2 / 22,8 |

- **Paridade das linhas**: a mesa começa com 1 peça e as peças põem-se à vez, por isso quem completa as linhas de comprimento ímpar é quase sempre o mesmo lugar. Na 1.0 o 2.º jogador ganhava 2/3 das partidas a 2. **Resolvido na 2.0.0**: colunas de 4 e 6 (as linhas ficam 5 e 7).
- **Salva-vidas cedo**: a 3 e 4 jogadores, os primeiros lugares vigiam primeiro as linhas que vão crescer (a 4, o 3.º lugar faz ~35 pontos com salva-vidas contra ~40 do 1.º). Compensações testadas (fichas a mais, baralho igual para todos, sem salva-vidas na 1.ª volta) não resolvem a 4; "sem salva-vidas na 1.ª volta" deixa os 3 jogadores justos (33 / 33 / 34) mas piora os 4. *A confirmar com jogadores reais* (os bots põem salva-vidas por uma regra simples).
- **Número de peças**: o jogo acaba quando o baralho tem menos peças do que jogadores, por isso o 1.º lugar põe mais uma peça do que os outros (a 3: 14 / 13 / 13; a 4: 11 / 10 / 10 / 10). Efeito pequeno.

## Nine Oils (1.1.0)

| Jogadores | Vitórias por lugar |
|---|---|
| 2 | 50,2 / 49,8 (quem começa é sorteado) |

- **Quem começa** ganha 53% (corrida às 6 garrafas: quem lança primeiro chega primeiro). Igual com 2 ou 3 Rapazes. *A confirmar; se se mantiver, compensar o 2.º jogador (ex.: começa com 1 carta a mais).*

## Bulbous (1.0.0)

| Jogadores | Vitórias por lugar |
|---|---|
| 2 | 50,2 / 49,8 |
| 4 | 25,3 / 24,7 / 25,2 / 24,8 |

- Sem vantagem de lugar. O Governante roda todas as rondas.

## Capivaras (protótipo 0.1.0)

| Jogadores | Vitórias por lugar |
|---|---|
| 2 | 49 / 51 |
| 3 | 35,5 / 32,3 / 32,2 |
| 4 | 27,2 / 23,8 / 26,6 / 22,4 |
| 5 | 20,6 / 20,8 / 19,7 / 19,8 / 19,1 |
| 6 | 18,0 / 19,0 / 16,6 / 14,5 / 16,5 / 15,4 |

- **Empates dão a vitória ao lugar mais baixo**: o código escolhe o primeiro com a pontuação máxima. É o que dá ao 1.º lugar os ~3 pontos a mais a 3 e 4 jogadores. *Decidir a regra de desempate* (partilhar a vitória, ou um critério do jogo, ex.: mais pássaros).
- As apostas são simultâneas: fora os empates, não há vantagem de lugar.
