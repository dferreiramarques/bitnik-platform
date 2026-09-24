# Decisões de arquitetura

Registo curto das decisões do contrato do motor (formato ADR: contexto, decisão, consequências). Validadas em setembro de 2026, antes da Fase 1, com verificação nos repos dos 4 jogos a migrar (Bulbous, Capivaras, Nine Oils, Praia das Percebes).

---

## ADR-001: Moves imperativas sobre uma cópia do estado

**Estado:** aceite (2026-09-24)

### Contexto

Os 4 jogos a migrar mutam o estado diretamente (`p.hand.splice(...)`, `g.players[seat].fichas--`). Hoje, uma handler que muta e só depois falha, ou lança uma exceção, deixa o estado meio alterado (ex.: `BOY_DEFEND` do Nine Oils gasta Bullies antes de resolver). Do lado da rede, o cliente podia reenviar uma jogada depois de uma reconexão, ou jogar sobre um estado que já tinha avançado, e o servidor aplicava-a ao estado atual.

Alternativas consideradas: moves puras que devolvem estado novo (verboso, sujeito a bugs de aliasing, obriga a reescrever os jogos) e Immer (dependência no motor, sem ganho sobre a cópia).

### Decisão

- Cada move recebe um `structuredClone` do estado e altera-o diretamente. Só é confirmada se terminar sem `ctx.invalid` e sem exceção: tudo-ou-nada.
- Uma exceção nas regras é convertida em `engine.RULE_ERROR` (`{ type, message }`). O match fica intacto, a simulação regista-a como falha e o servidor escreve-a no log.
- O `MOVE` leva o `seq` do estado que o jogador viu. Se o match já avançou, o motor recusa com `engine.STALE_MOVE` e o servidor reenvia o `ROOM` atual.
- `client.move()` envia o `seq` automaticamente e devolve `false` quando não há ligação.

### Consequências

- A lógica dos jogos existentes passa quase linha a linha; o trabalho de migração é separar regras de lobby e broadcast.
- Uma jogada é idempotente: reenviada, não é aplicada duas vezes. O servidor é a única fonte de verdade e o cliente nunca fica à espera de um estado que não existe: ao reconectar recebe o último estado confirmado.
- Custo: uma cópia do estado por jogada (microssegundos nestes tamanhos).
- O `seq` no `MOVE` é opcional para o servidor (clientes antigos continuam a funcionar sem a proteção).

---

## ADR-002: Timers declarativos (`ctx.schedule` + `events`)

**Estado:** aceite (2026-09-24)

### Contexto

Os jogos atuais usam `setTimeout` dentro da lógica, protegido por `if (g.turnGen !== gen) return`. Os timers perdem-se num restart e não há replay nem simulação determinística. Nos 4 repos, a maioria dos `setTimeout` não são regras: são o ritmo dos bots, animações e a substituição de jogadores desligados. Só dois são regras: o desempate de 20 s do Bulbous (`tieBreakTimeout`) e a pausa de 5 s da revelação nas Capivaras (`REVEAL_MS`).

Alternativas consideradas: manter `setTimeout` nas regras (perde persistência, replay e simulação) e um evento `TICK` periódico com a hora real (suja o registo e obriga a guardar o relógio para o replay).

### Decisão

- As regras pedem tempo com `ctx.schedule(key, ms, EVENTO, payload)` e reagem em `events.EVENTO`. O motor guarda os timers no match; o servidor executa-os e guarda o prazo absoluto na sala.
- O `ROOM` inclui `timers: [{ key, event, at }]` e `now`, para a UI mostrar contagens decrescentes (a UI genérica já o faz).
- A simulação usa um relógio simulado com a mesma regra do servidor e dispara o timer que vence primeiro (antes disparava o primeiro da lista).
- `simulate({ idleRate })` põe os bots a deixar esgotar o tempo numa proporção das vezes, de forma determinística.

### Consequências

- Na migração, 2 timers passam a `events`; os restantes desaparecem, porque o servidor já trata do ritmo dos bots e dos lugares ausentes.
- Os cartões Gherkin da Fase 1 do tipo "Quando passam 20 s" têm teste: `fireTimer` num teste unitário, `idleRate` na simulação.
- As regras não sabem a hora: "quem respondeu primeiro" não pode ser regra. Nenhum dos 4 jogos precisa disso.

