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

---

## ADR-003: Um RNG por match; bots num RNG derivado de `seed + seq + lugar`

**Estado:** aceite (2026-09-24)

### Contexto

O match guarda o estado do gerador (mulberry32, um inteiro) e as regras só tiram aleatoriedade de `ctx.rng`. Os 4 jogos a migrar usam `Math.random` para baralhar, lançar dados, escolher quem começa e nos bots. Na verificação apareceram dois problemas:

- os bots recebiam o estado completo, com a informação escondida. O bot atual das Capivaras já faz batota: lê a aposta secreta do outro bot (`g.bets[...]`) e evita essa carta;
- nada impedia um pacote de usar `Math.random` ou o relógio, e na Fase 1 o código vem da Forge.

Alternativas consideradas: os bots usarem o RNG do match (o que o bot "pensa" passaria a mudar os dados, e uma partida com bot divergia da mesma partida com humano) e RNG criptográfico sem seed (perde replay e simulação).

### Decisão

- Um RNG por match, guardado no match; a seed nunca sai do servidor.
- Os bots usam um RNG derivado de `seed + seq + lugar` e recebem `bot(view, seat, { rng, legal, numPlayers })`: veem o mesmo que um humano nesse lugar.
- `checkPurity(source, file)` no motor recusa `Math.random`, relógio, timers do sistema, rede, `process`, `require` e imports que não sejam `@bitnik/engine` ou `./`. Os testes de cada pacote correm-no sobre todos os ficheiros.
- Motor passa a `0.2.0` (a assinatura dos bots mudou); Catania passa a `3.0.1` (bot adaptado, regras iguais; a simulação de 1000 partidas dá exatamente os mesmos números).

### Consequências

- Na migração, `Math.random` → `ctx.rng` é mecânico; o cuidado é passar o `rng` às funções auxiliares (o `shuffle` global, o `drawCard` do Nine Oils que volta a baralhar o descarte).
- O bot das Capivaras tem de deixar de ler as apostas dos outros (passa a jogar só com o `view`).
- O mulberry32 tem 2³² estados (cerca de 4 mil milhões de baralhos possíveis). Chega para jogos de tabuleiro. **Não serve jogos a dinheiro**, que estão fora do âmbito da plataforma.

---

## ADR-004: Incompatibilidade por versão; avisos antes de um deploy

**Estado:** aceite (2026-09-24)

### Contexto

Cada match guarda a `gameVersion`. Ao arrancar, o servidor comparava só o primeiro número: mesas solo de outro major eram apagadas sem aviso e as públicas reiniciadas. Na verificação:

- em `0.x` nada era invalidado (`'0.1.0'` e `'0.2.0'` davam os dois major `'0'`), e os protótipos do Studio vão viver em `0.x`;
- a `engineVersion` era guardada mas nunca verificada;
- o jogador perdia a mesa solo sem saber porquê, e perdia-se o registo para reproduzir bugs;
- num runtime de cliente, cada deploy reinicia o processo. As partidas são guardadas e os clientes voltam a ligar-se, por isso só perde a partida quem está num jogo que mudou de versão incompatível; mas ninguém é avisado antes.

Nenhum dos 4 jogos a migrar guarda partidas hoje (tudo em memória): não há nada antigo a respeitar.

Alternativas consideradas: `migrate(state, fromVersion)` no pacote (cada mudança de regras obriga a escrever e testar migrações, difíceis de gerar pela Forge, para partidas que duram minutos) e manter duas versões instaladas ao mesmo tempo (ver abaixo).

### Decisão

- `compatibleVersions(a, b)`: semver à letra, incluindo `0.x` (compara o primeiro número não nulo). Aplica-se à versão do jogo e à do motor (`matchIncompatibility`).
- Mesas solo incompatíveis ficam `expired`: aparecem com o aviso, recusam jogadas (`server.EXPIRED`), podem recomeçar com a versão nova e guardam o match para replay. Mesas públicas voltam a "à espera".
- `replay` avisa quando a versão do jogo não é a da partida.
- Avisos do publisher: `platform.notify(...)` / `POST /admin/notices` (com `ADMIN_TOKEN`), enviados a todos os ligados (`NOTICES`) e no `WELCOME`, guardados no storage até `until`. Com `maintenance`, deixam de começar partidas novas dos jogos indicados (`server.MAINTENANCE`) e as que decorrem continuam.

### Consequências

- Um deploy anunciado com janela de manutenção chega à hora marcada com poucas ou nenhumas mesas a meio no jogo atualizado.
- No Studio, mudar o minor de um protótipo `0.x` expira as partidas de teste antigas.
- Sem `migrate` por agora: pode entrar mais tarde como hook opcional sem partir nada.
- **Evolução futura:** instalar duas versões ao mesmo tempo (`catania@3` e `catania@4`, indexadas por `id@major`, com aliases npm), para as partidas a decorrer acabarem na versão antiga. Elimina o kick por completo; rever quando houver um cliente com partidas longas ou muitos jogadores em simultâneo.

