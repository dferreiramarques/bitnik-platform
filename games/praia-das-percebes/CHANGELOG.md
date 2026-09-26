# Praia das Percebes — histórico de regras

## 1.0.0 — Migração para a plataforma (2026-09-26)

Regras migradas do servidor antigo (repositório `praiadaspercebes`, `server.js`), sem mudanças de jogo. `REGRAS.md` escrito a partir das regras do jogo online antigo. Bots iguais aos antigos.

Comportamentos do jogo antigo mantidos, para rever:

- Uma linha ou coluna com buracos conta só o troço à volta do salva-vidas e **não aplica** as pranchas (numa linha sem buracos, aplica).
- As "voltas extra" quando um jogador fica sem fichas existiam no código antigo mas nunca eram usadas: não passaram.

Vitórias por lugar em simulação com bots (300 partidas):

| Jogadores | Vitórias por lugar (%) |
|---|---|
| 2 | 34,3 / **65,7** |
| 3 | 37,3 / 31,5 / 31,2 |
| 4 | 22,6 / 34,1 / 14,7 / 28,6 |

**A 2 jogadores o 2.º lugar ganha dois terços das partidas**, e a 4 há diferenças grandes entre lugares. Os bots são simples: confirmar numa mesa de aprovação antes de mexer nas regras.

Por fazer: UI própria (por agora usa a UI genérica de protótipo, que mostra as posições como coordenadas).
