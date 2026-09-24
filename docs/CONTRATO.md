# Contrato de um pacote de jogo (v0.1)

Este é o documento a validar. Tudo o resto da plataforma (servidor, UI genérica, simulação, Forge) depende só disto. Um jogo que cumpre o contrato corre no Studio e em qualquer runtime de cliente sem alterações.

## Princípio

As regras são **funções puras sobre um estado JSON**. Não usam rede, relógio nem `Math.random`. Tudo o que é aleatório vem de `ctx.rng` e tudo o que depende de tempo é pedido com `ctx.schedule`. Com isto, qualquer partida pode ser guardada, retomada, repetida a partir da seed e simulada milhares de vezes.

## Forma do pacote

```js
import { defineGame } from '@bitnik/engine';

export default defineGame({
  id: 'catania',            // único dentro de um deploy
  version: '3.0.0',         // semver; mudar o major invalida partidas guardadas
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
  bots: { default(state, seat, { rng }) → move },
  describeMove(move, view) → { key, params },     // rótulo para a UI genérica
});
```

Os ficheiros de um pacote só podem importar `@bitnik/engine` e ficheiros próprios (há um teste que verifica isto). É o que garante que o pacote entregue a um cliente não arrasta nada do Studio.

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

O servidor executa o timer e o evento fica no registo de jogadas como `@TIE_TIMEOUT`, por isso o replay reproduz tudo.

## O match

`createMatch(game, { numPlayers, seed })` devolve um objeto JSON com `seed`, `rng`, `seq`, `state`, `moves`, `log`, `timers` e `result`. É isto que o servidor guarda. `replay(game, match)` reconstrói o estado a partir da seed e das jogadas: se o resultado não bater certo, há não-determinismo nas regras.

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
2. **Timers declarativos** em vez de `setTimeout` nas regras. Obriga a reescrever os timers do Bulbous, Capivaras e Nine Oils como eventos.
3. **Um RNG por match, guardado no estado do match.** Bots usam um RNG derivado de `seed + seq + lugar`, também determinístico.
4. **Incompatibilidade por major.** Uma partida guardada com `1.x` não é retomada com `2.x`: mesas solo antigas são apagadas e mesas públicas reiniciadas.
5. **`describeMove` no pacote**, para a UI genérica mostrar jogadas legíveis sem UI própria.
