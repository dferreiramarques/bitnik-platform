# Nine Oils — histórico de regras

## 1.1.0 — 2 Rapazes (2026-09-26)

- **2 Rapazes** (8 cartas de Personagem), como nas regras escritas. Simulação com 20 000 partidas por versão: quem começa ganha 53,1% com 2 Rapazes e 53,7% com 3; há metade dos roubos (0,36 contra 0,76 por partida). Não desequilibra.
- Na escolha de combinações, as melhores (as que nenhuma outra opção contém) aparecem primeiro e com ★.

## 1.0.0 — Migração para a plataforma (2026-09-26)

Regras migradas do servidor antigo (repositório `nineoils-v2`, `server.js`, v1.4), sem mudanças de jogo. `REGRAS.md` é a edição portuguesa do README antigo. Bot igual ao antigo (joga Sedutoras ou um Rapaz, escolhe a melhor combinação, bloqueia sempre que pode, nunca usa 2 Valentões para atacar).

Para rever:

- O baralho do jogo antigo tinha 3 Rapazes (resolvido na 1.1.0: 2).
- Quando um lançamento dá várias opções, a lista inclui também conjuntos com menos combinações (resolvido na 1.1.0: as melhores com ★).
- A pausa depois de lançar (para os dois verem os dados) é uma jogada, "Continuar".

Vitórias por lugar em simulação com bots (1000 partidas, quem começa é sorteado): 48,8 / 51,2.

Por fazer: UI própria (por agora usa a UI genérica de protótipo).
