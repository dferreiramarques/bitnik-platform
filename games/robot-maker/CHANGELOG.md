# Robot Maker — histórico de regras
## 2.1.0 — Tutorial interativo (2026-10-02)

Sem mudanças de regras: o jogo ganha um tutorial interativo ("Tutorial", ao lado de "Como se joga", no lobby). Joga-se a 2, contra o bot, com o motor verdadeiro no browser: o tabuleiro, a Forja (fase dos workers), a compra no mercado (fase 2), o turno do bot, a rotação da ronda e, em texto, os circuitos, a pontuação do robot e o fim do jogo. O jogador começa com 2 L1 na lição para poder comprar logo. Usa o guia de passos e a partida local da plataforma (`ctx.tour`, `ctx.session`, ADR-018).


## 2.0.0 — Turno em duas fases e mercado que roda (2026-10-02)

- Turno em duas fases, por esta ordem: primeiro os workers no tabuleiro (um por ação) e depois uma compra no mercado, que já não gasta worker e acaba o turno. Novas jogadas: `IR_AO_MERCADO` (acaba a fase dos workers) e erro `err.FASE`.
- Se não houver nada que se possa pagar, o turno acaba logo depois do último worker.
- Circuito: pela Forja o worker novo joga já; por compra só joga na ronda seguinte.
- Mercado: a peça mais à esquerda de cada nível vai para o fundo do baralho no fim da ronda se ninguém a adquiriu (antes só rodava quando ninguém adquiria nada desse nível, e com a Forja a comprar L1 todas as rondas o mercado ficava parado).
- Estado novo (`fase`, `adquiridos` por nível com os slots): as mesas de 1.x ficam expiradas.
- Simulação com bots (300 partidas): 15 peças diferentes vistas no mercado por partida; rondas médias 10,9 (2 jogadores), 10,4 (3) e 10,8 (4).

## 1.1.0 — Jogo mais longo, mais peças L1 (2026-10-02)

- Gatilho do fim de jogo: 6 slots preenchidas, pelo menos 1 peça L3 e 3 peças de nível 2 ou mais (1×L3, 2×L2, 3×L1, CPU incluída). Antes bastava 1 peça L3.
- Stock das peças de nível 1: 8 por peça e por CPU (eram 4), para nunca escassearem. Níveis 2 e 3 não mudam.
- Simulação com bots (200 partidas por número de jogadores): rondas médias 11.9 → 15.1 (2 jogadores), 12.4 → 15.9 (3) e 12.3 → 14.7 (4).

## 1.0.0 — Publicado (2026-10-02)

Publicado a partir da Forge (regras 0.1.0, 27 testes aprovados).

Vitórias por lugar em simulação com bots:

| Jogadores | Vitórias por lugar (%) |
|---|---|
| 2 | 22 / 78 |
| 3 | 2 / 76 / 22 |
| 4 | 32 / 46 / 20 / 2 |

## Protótipos

- 0.1.0: Regras confirmadas: partida p1 e 27 testes aprovados
