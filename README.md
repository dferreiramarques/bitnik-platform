# bitnik-platform

Motor, servidor e ferramentas para desenhar, testar e entregar jogos de tabuleiro online. Um deploy por marca: o **Bitnik Studio** (a instância da Bitnik, onde se criam e aprovam jogos) e um **runtime** por publisher cliente, que recebe só os jogos vendidos.

Estado: **Fase 0c**. Contrato validado (ver `docs/DECISOES.md`), motor, servidor genérico, pacote de jogo com i18n e o Catania como primeiro pacote, a correr no Studio e num runtime limpo, com consola de administração.

## Estrutura

```
packages/
  engine/     @bitnik/engine  contrato, seed, timers declarativos, replay, simulação
  server/     @bitnik/server  createPlatform: salas, sessões, bots, timers, storage, UI genérica
  client/     @bitnik/client  SDK de browser: identidade, reconexão, protocolo
games/
  catania/    @bitnik/game-catania  primeiro pacote de jogo (regras, bot, i18n PT/EN, testes)
apps/
  studio/     instância Bitnik (todos os jogos, modo studio)
examples/
  clean-runtime/  o que um cliente recebe: outra marca, só os pacotes entregues
tools/
  simulate.js partidas com bots em série
docs/
  CONTRATO.md o contrato de um pacote de jogo (ler primeiro)
```

## Começar

```bash
npm install
npm test                        # motor, Catania e plataforma ponta a ponta
npm run studio                  # http://localhost:3000
PORT=3001 npm run runtime       # runtime de exemplo
npm run simulate -- catania 500
```

`ADMIN_TOKEN` ativa as rotas `/admin` (avisos). `DATA_DIR` escolhe onde as partidas são guardadas (por omissão `./data/studio` e `./data/runtime`). Em Railway, aponta para um volume.

## Consola

Com `ADMIN_TOKEN` definido, cada deploy tem uma consola em `/console` (entra-se com o token):

- **Painel**: marca, versão do motor e do Node, tempo ligado, jogos, mesas e jogadores ligados.
- **Jogos**: pacotes instalados, versão, línguas, validação do contrato e simulação com bots (vitórias por lugar), sem bloquear as mesas.
- **Mesas de aprovação**: mesas privadas por convite; cria-se na consola, copia-se o link e quem o abre senta-se e joga. Lugares vazios passam a bots.
- **Avisos**: atualização marcada ou texto livre (PT/EN), com opção de suspender partidas novas até ao deploy.
- **Forge**: chega na Fase 1.

```bash
ADMIN_TOKEN=um-segredo npm run studio   # http://localhost:3000/console
```

A consola usa a API `/admin/*` (`status`, `games`, `games/:id/simulate`, `tables`, `notices`), sempre com `Authorization: Bearer $ADMIN_TOKEN`. Sem token, nem a consola nem a API existem.

## Como as peças encaixam

```
pacote de jogo ──► @bitnik/engine ◄── @bitnik/server ◄──ws──► @bitnik/client ◄── UI (genérica ou à medida)
 (regras puras)     (match JSON)       (salas, bots,                                 
                                        timers, storage)
```

**Mesas públicas**: uma por número de jogadores de cada jogo. Quem se senta começa quando quiser e os lugares vazios passam a bots. Se alguém sai a meio, um bot fica com o lugar; se perde a ligação, um bot joga por ele até voltar.

**Mesas de aprovação**: privadas, criadas na consola; só entra quem tem o link. Jogam-se como as públicas e aparecem em "As minhas mesas" de quem se sentou.

**Mesas solo**: uma instância privada por utilizador, com bots. Aparecem em "As minhas mesas", sobrevivem a restarts e podem ser retomadas.

**Identidade**: token por dispositivo, guardado no browser. Não há contas nesta fase.

**Protocolo** (cliente → servidor): `HELLO`, `SET_NAME`, `LIST`, `CREATE_SOLO`, `OPEN`, `CLOSE`, `JOIN`, `LEAVE`, `START`, `MOVE`, `RESTART`, `DELETE`, `PING`. O servidor responde com `WELCOME`, `ROOMS`, `ROOM`, `NOTICES` e `ERROR` (sempre com uma chave i18n).

**Avisos e atualizações**: com `ADMIN_TOKEN` definido, `POST /admin/notices` anuncia uma atualização a todos os jogadores do deploy e pode abrir uma janela de manutenção (sem partidas novas de um jogo até ao deploy). Ver `docs/CONTRATO.md`.

## Um deploy para um cliente

```js
import { createPlatform, fileStorage } from '@bitnik/server';
import jogoDoCliente from '@cliente/game-exemplo';

createPlatform({
  brand: { id: 'cliente', name: 'Editora X', stylesheets: [...], tokens: { '--color-brick': '#1f4e6b' } },
  games: [jogoDoCliente],
  storage: fileStorage(process.env.DATA_DIR),
}).listen(process.env.PORT);
```

Ver `examples/clean-runtime/`. A marca usa o design system da Bitnik como base e troca só os tokens.

## Próximos passos

Fase 0b: UI própria do Catania (portar o tabuleiro do `catania-v2` para o SDK), service worker para a PWA.
Fase 1: Forge a gerar `rules.js` e testes a partir dos cartões Gherkin.
Fase 2: migrar Bulbous, Capivaras, Praia das Percebes e Nine Oils; mesas de aprovação por convite.
