# Praia das Percebes — histórico de regras

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

Com os bots de sempre (2000 partidas): 2 jogadores 46,4 / 53,6; 3 jogadores 29,7 / 39,1 / 31,2; 4 jogadores 28,6 / 28,4 / 20,2 / 22,8. A 4 jogadores o 3.º e o 4.º lugares ainda ficam abaixo: a rever.

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
