# Contrato de um pacote de jogo (v0.2)

Este é o documento a validar. Tudo o resto da plataforma (servidor, UI genérica, simulação, Forge) depende só disto. Um jogo que cumpre o contrato corre no Studio e em qualquer runtime de cliente sem alterações.

## Princípio

As regras são **funções puras sobre um estado JSON**. Não usam rede, relógio nem `Math.random`. Tudo o que é aleatório vem de `ctx.rng` e tudo o que depende de tempo é pedido com `ctx.schedule`. Com isto, qualquer partida pode ser guardada, retomada, repetida a partir da seed e simulada milhares de vezes.

## Forma do pacote

```js
import { defineGame } from '@bitnik/engine';

export default defineGame({
  id: 'catania',            // único dentro de um deploy
  version: '3.0.1',         // semver; uma versão incompatível não retoma partidas guardadas
  players: { min: 2, max: 4 },
  defaultLang: 'pt',
  i18n: { pt: {...}, en: {...} },   // mesmas chaves em todas as línguas (verificado)

  setup(ctx) → state,
  moves: { NOME(state, payload, ctx) },
  activePlayers(state) → [seat],
  view(state, seat) → o que esse lugar vê,
  result(state) → null | { scores, winners, ... },

  // opcionais
  enumerate(state, seat) → [{ type, payload }],   // jogadas legais
  events: { NOME(state, payload, ctx) },          // disparados por timers
  bots: { default(view, seat, { rng, legal, numPlayers }) → move },
  describeMove(move, view) → { key, params },     // rótulo para a UI genérica
});
```

Os ficheiros de um pacote só podem importar `@bitnik/engine` e ficheiros próprios (`./`), e não usam `Math.random`, `Date.now`, `new Date`, `setTimeout`/`setInterval`, `fetch`, `process` nem `require`. `checkPurity(source, file)` do motor verifica isto e cada pacote tem um teste que o corre sobre todos os seus ficheiros. É o que garante que o pacote entregue a um cliente não arrasta nada do Studio e que as regras são determinísticas.

## As peças, uma a uma

**`setup(ctx)`** cria o estado inicial. Tem `ctx.numPlayers`, `ctx.options` e `ctx.rng`. Pode agendar timers.

**`moves`** são as jogadas. Recebem uma cópia do estado e alteram-na diretamente (estilo imperativo, como o código atual dos jogos). Para recusar, devolvem `ctx.invalid('err.CODIGO', params)`: o motor descarta a cópia e o estado fica intacto. Se a move lançar uma exceção, acontece o mesmo e a jogada é recusada com `engine.RULE_ERROR` (tudo-ou-nada). O motor já garante antes de chamar a move que o jogo não acabou, que o tipo existe e que o lugar está em `activePlayers`.

`applyMove(game, match, seat, move, { expectSeq })` recusa com `engine.STALE_MOVE` uma jogada pensada sobre um estado antigo. O servidor usa o `seq` que vem no `MOVE` (o SDK envia-o sozinho) e, nesse caso, reenvia o estado atual.

**`ctx`** dentro de uma move:

| | |
|---|---|
| `ctx.seat` | quem joga (`null` em eventos) |
| `ctx.rng` | `next()`, `int(n)`, `chance(p)`, `pick(arr)`, `shuffle(arr)` |
| `ctx.log(key, params)` | entrada de registo traduzível; parâmetros com `@` são chaves (`'@res.vinho'`) |
| `ctx.schedule(key, ms, event, payload)` | agenda um evento; a mesma `key` substitui o anterior |
| `ctx.cancel(key)` | cancela um timer |
| `ctx.invalid(code, params)` | recusa a jogada |

**`activePlayers(state)`** diz quem pode jogar agora. Um array permite jogadas simultâneas (apostas às cegas, como nas Capivaras). Um array vazio com timers pendentes significa "à espera do relógio".

**`view(state, seat)`** esconde o que cada lugar não deve ver. `seat = null` é um espectador. É aqui que ficam as mãos ocultas.

**`bots`** recebem o `view` do seu lugar (nunca o estado completo), as jogadas legais e um `rng` próprio, derivado de `seed + seq + lugar`. Um bot vê o mesmo que um humano sentado nesse lugar, e as decisões dele não gastam o RNG do match: trocar um humano por um bot não muda os dados nem os baralhos. Sem bot no pacote, o motor escolhe uma jogada legal ao acaso.

**`result(state)`** devolve `null` enquanto o jogo decorre. No fim, pelo menos `scores` (por lugar) e `winners` (lugares; mais de um é empate).

**`events`** são o substituto dos `setTimeout` que hoje estão dentro das regras. Exemplo do tie-break de 20 s do Bulbous:

```js
// dentro da move que cria o empate
ctx.schedule('tiebreak', 20000, 'TIE_TIMEOUT');
// ...
events: {
  TIE_TIMEOUT(state, payload, ctx) { /* resolve com quem respondeu */ },
}
```

O servidor executa o timer e o evento fica no registo de jogadas como `@TIE_TIMEOUT`, por isso o replay reproduz tudo. O prazo absoluto de cada timer é guardado com a sala (sobrevive a um restart) e vai no `ROOM` como `timers: [{ key, event, at }]`, com `now` (hora do servidor) para a UI mostrar a contagem decrescente. O nome visível do evento é a chave `event.NOME`, se existir.

Na simulação, os timers vencem num relógio simulado com a mesma regra do servidor (agendamento + `delayMs`), por ordem de prazo. `simulate({ idleRate })` faz os bots deixarem esgotar o tempo nessa proporção das vezes, para os `events` de timeout também serem testados (`npm run simulate -- jogo 500 0.2`).

Não são timers do jogo, e ficam fora das regras: o ritmo dos bots, a animação e a substituição de quem se desliga (o servidor põe um bot no lugar).

**`describeMove(move, view)`** (opcional) traduz uma jogada numa frase: `{ key, params }`. É o que dá nome aos botões da UI genérica e às linhas do histórico enquanto o jogo não tem tabuleiro próprio. O motor (`describeMove(game, move, view)`, usado pelo `viewFor`) tenta, por esta ordem:

1. o `describeMove` do pacote (se lançar uma exceção, é ignorado: a mesa não parte);
2. a chave `moveLabel.TIPO`, se existir, com o payload como parâmetros (`'moveLabel.PLACE_TILE': 'Colocar peça em ({r},{c})'`);
3. `move.TIPO`, sem parâmetros.

Jogos simples não precisam da função. É necessária quando a frase depende do `view` (no Catania, o recurso do hexágono). O servidor envia só a chave e os parâmetros; cada cliente traduz na língua do jogador.

Estado de interface (cartas selecionadas, destaques) não entra no `state`: uma jogada é uma decisão completa (`PLAY_CARDS { idx: [...] }`, não `SELECT_CARD` repetido).

## O match

`createMatch(game, { numPlayers, seed })` devolve um objeto JSON com `seed`, `rng`, `seq`, `state`, `moves`, `log`, `timers` e `result`. É isto que o servidor guarda. `replay(game, match)` reconstrói o estado a partir da seed e das jogadas: se o resultado não bater certo, há não-determinismo nas regras.

## Versões e partidas guardadas

A versão do pacote segue semver à letra: uma partida guardada só é retomada se `compatibleVersions(guardada, instalada)`, ou seja, se o primeiro número não nulo for igual (`3.0.0` ↔ `3.2.1`; `0.2.0` ↔ `0.2.5`, mas não ↔ `0.3.0`; `0.0.3` só ↔ `0.0.3`). Os protótipos no Studio vivem em `0.x`: cada minor que mude regras invalida as partidas de teste. A mesma regra aplica-se à `engineVersion` guardada no match.

Com uma versão incompatível, as mesas solo ficam `expired`: continuam em "As minhas mesas" com o aviso, não aceitam jogadas (`server.EXPIRED`), podem recomeçar com a versão nova, e o match fica guardado para replay. As mesas públicas voltam a "à espera".

`replay` só é garantido com a versão exata. Um patch que corrija um bug pode fazer uma partida antiga divergir; `replay` avisa quando a `gameVersion` do match não é a instalada.

**Antes de um deploy**, o publisher (ou a Bitnik) anuncia a atualização com `platform.notify(...)` ou `POST /admin/notices` (com `Authorization: Bearer $ADMIN_TOKEN`):

```js
platform.notify({
  key: 'notice.UPDATE_AT', at: horaDoDeploy,       // ou text: { pt, en }
  maintenance: { games: ['catania'], from: agora }, // opcional; games: null = todos
});
```

O aviso chega a todos os ligados (`NOTICES`) e a quem se ligar depois (`WELCOME.notices`), sobrevive a restarts e acaba em `until` (por omissão, `at`). Durante a janela de manutenção não começam partidas novas desses jogos (`server.MAINTENANCE`); as que decorrem continuam.

## i18n

Todo o texto visível sai de chaves: `game.name`, `game.tagline`, `move.X`, `moveLabel.X`, `log.X`, `err.X`, e as que o jogo precisar (`res.vinho`). `checkGame` recusa pacotes em que as línguas não têm as mesmas chaves, e os testes do Catania verificam que cada `err.`/`log.` usado nas regras existe em PT e EN.

## Ligação ao Forge (Fase 1)

A taxonomia BGE mapeia diretamente no contrato:

| Forge | Contrato |
|---|---|
| DATA | forma do `state` e o que `view` mostra |
| FLOW | fases dentro do `state`, `activePlayers`, `events` |
| ACTION | `moves` (e `enumerate`) |
| SCORE | efeitos dentro das moves e `result` |
| Cartão Gherkin | um teste: *Dado* monta o estado, *Quando* aplica a move, *Então* verifica |

Os testes em `games/catania/test/` já estão escritos assim, um por regra do REGRAS.md, para servirem de modelo ao que o Forge vai gerar.

## Decisões

Validadas uma a uma e registadas em [DECISOES.md](DECISOES.md).

1. **Moves imperativas sobre uma cópia**, em vez de funções que devolvem estado novo. Tudo-ou-nada, incluindo exceções (`engine.RULE_ERROR`); jogadas sobre estados antigos são recusadas (`engine.STALE_MOVE`). Aceite: ADR-001.
2. **Timers declarativos** em vez de `setTimeout` nas regras. Na migração só 2 timers são regras (desempate do Bulbous, pausa da revelação das Capivaras); os prazos vão no `ROOM` e a simulação exercita os timeouts. Aceite: ADR-002.
3. **Um RNG por match, guardado no estado do match.** Bots usam um RNG derivado de `seed + seq + lugar` e jogam sobre o `view`; `checkPurity` impede aleatoriedade e relógio fora do motor. Não serve jogos a dinheiro. Aceite: ADR-003.
4. **Incompatibilidade por versão (semver à letra, incluindo `0.x` e o motor).** Mesas solo antigas ficam `expired` em vez de apagadas; avisos e janela de manutenção antes de um deploy. Aceite: ADR-004.
5. **`describeMove` no pacote, opcional**, com rede de segurança no motor e rótulo por convenção (`moveLabel.TIPO` + payload). Aceite: ADR-005.
