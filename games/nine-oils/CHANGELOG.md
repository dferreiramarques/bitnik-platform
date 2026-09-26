# Nine Oils — histórico de regras

## 1.0.0 — Migração para a plataforma (2026-09-26)

Regras migradas do servidor antigo (repositório `nineoils-v2`, `server.js`, v1.4), sem mudanças de jogo. `REGRAS.md` é a edição portuguesa do README antigo. Bot igual ao antigo (joga Sedutoras ou um Rapaz, escolhe a melhor combinação, bloqueia sempre que pode, nunca usa 2 Valentões para atacar).

Para rever:

- **O baralho do jogo tem 3 Rapazes** (9 cartas de Personagem); as regras escritas falam em 2 (8 cartas). A plataforma segue o jogo.
- Quando um lançamento dá várias opções, a lista inclui também conjuntos com menos combinações (por exemplo, só um Duplo); o jogo antigo fazia o mesmo.
- A pausa depois de lançar (para os dois verem os dados) é uma jogada, "Continuar".

Vitórias por lugar em simulação com bots (1000 partidas, quem começa é sorteado): 48,8 / 51,2.

Por fazer: UI própria (por agora usa a UI genérica de protótipo).
