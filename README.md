# bitnik-platform

Motor, servidor e ferramentas para desenhar, testar e entregar jogos de tabuleiro online. Um deploy por marca: o **Bitnik Studio** (a instância da Bitnik, onde se criam, testam e aprovam jogos) e um **runtime** por publisher cliente, que recebe só os jogos vendidos.

Cada jogo é um pacote versionado que só depende de `@bitnik/engine`. As regras são puras (sem rede, relógio nem `Math.random`), por isso uma partida reproduz-se a partir da seed.

Estado das fases e próximos passos: [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Documentação

| Ficheiro | Para quê |
|---|---|
| [`docs/CONTRATO.md`](docs/CONTRATO.md) | O contrato de um pacote de jogo (ler primeiro) |
| [`docs/DECISOES.md`](docs/DECISOES.md) | As decisões de arquitetura (ADR) |
| [`docs/EQUILIBRIO.md`](docs/EQUILIBRIO.md) | Vantagens de lugar por jogo, com números de simulação |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Estado das fases e passos de cada uma |

## Estrutura

```
packages/
  engine/     @bitnik/engine   contrato, seed, timers declarativos, replay, simulação
  server/     @bitnik/server   createPlatform: salas, sessões, bots, timers, storage, UI genérica, consola, Forge
  client/     @bitnik/client   SDK de browser: identidade, reconexão, protocolo
games/        pacotes de jogo (regras, bot, i18n PT/EN, testes, REGRAS.md, CHANGELOG.md)
apps/
  studio/     instância Bitnik (todos os jogos, modo studio)
examples/
  clean-runtime/  o que um cliente recebe: outra marca, só os pacotes entregues
tools/
  simulate.js partidas com bots em série
  figma.js    tokens para as Variables do Figma
design/
  vanilla/    skin neutra de referência para jogos novos
  figma/      tokens do Figma e o guião do template (TEMPLATE.md)
```

Jogos instalados no Studio:

| Jogo | Pacote | Versão | Jogadores | UI |
|---|---|---|---|---|
| Catania | `games/catania` | 4.0.1 | 2–4 | Própria (tabuleiro, tutorial, temas) |
| Praia das Percebes | `games/praia-das-percebes` | 2.0.0 | 2–4 | Genérica |
| Nine Oils | `games/nine-oils` | 1.1.0 | 2 | Genérica |
| Bulbous | `games/bulbous` | 1.0.0 | 2 ou 4 | Genérica |
| Capivaras | `games/capivaras` | 1.0.0 | 2–6 | Genérica (feito pela Forge) |

As versões de cada jogo estão no `package.json` e as mudanças no `CHANGELOG.md` do pacote.

## Comandos

Node 22.13+ (a verificação isolada da Forge usa `--permission`; ver `.nvmrc`).

```bash
npm install
npm test                                # motor, jogos e plataforma ponta a ponta
npm run studio                          # http://localhost:3000
ADMIN_TOKEN=segredo npm run studio      # com a consola em /console
PORT=3001 npm run runtime               # runtime de exemplo
npm run simulate -- catania 500         # partidas com bots em série
npm run figma                           # gera os tokens para o Figma
```

`DATA_DIR` escolhe onde as partidas (e, no Studio, os projetos e protótipos da Forge) são guardados; por omissão `./data/studio` e `./data/runtime`. Em Railway, aponta para um volume.

## Consola

Com `ADMIN_TOKEN` definido, cada deploy tem uma consola em `/console` (entra-se com o token). Sem token, nem a consola nem a API `/admin/*` existem; a API pede sempre `Authorization: Bearer $ADMIN_TOKEN`.

- **Painel**: marca, versão do motor e do Node, tempo ligado, jogos, mesas e jogadores ligados.
- **Jogos**: pacotes instalados, versão, línguas, validação do contrato e simulação com bots (vitórias por lugar), sem bloquear as mesas.
- **Mesas de aprovação**: mesas privadas por convite; cria-se na consola, copia-se o link e quem o abre senta-se e joga. Lugares vazios passam a bots.
- **Avisos**: atualização marcada ou texto livre (PT/EN), com opção de suspender partidas novas até ao deploy.
- **Aparência**: tokens, temas e pré-visualização da UI de cada jogo.
- **Forge** (só no Studio): cria um jogo novo a partir de cartões de regras. O fluxo é: cartões → partida narrada pela IA → commit das regras → testes aprovados → código (copiar/colar) → verificação isolada → protótipo 0.x instalado sem reiniciar → publicar como 1.0.0 em `games/<id>/`. A publicação não mexe no Git: rever, juntar ao `apps/studio/server.js` e fazer commit à mão. Decisões em ADR-009 a ADR-013.

## Como as peças encaixam

```
pacote de jogo ──► @bitnik/engine ◄── @bitnik/server ◄──ws──► @bitnik/client ◄── UI (genérica ou à medida)
 (regras puras)     (match JSON)       (salas, bots,
                                        timers, storage)
```

**Mesas públicas**: uma por número de jogadores de cada jogo. Quem se senta começa quando quiser e os lugares vazios passam a bots. Se alguém sai a meio, um bot fica com o lugar; se perde a ligação, um bot joga por ele até voltar.

**Mesas de aprovação**: privadas, criadas na consola; só entra quem tem o link. Jogam-se como as públicas e aparecem em "As minhas mesas" de quem se sentou.

**Mesas solo**: uma instância privada por utilizador, com bots. Aparecem em "As minhas mesas", sobrevivem a restarts e podem ser retomadas.

**Identidade**: token por dispositivo, guardado no browser. Não há contas.

**PWA**: a app instala-se no telemóvel e tem um service worker (`/sw.js`). O HTML vem primeiro da rede (um deploy novo chega logo); motor, UI e ficheiros dos jogos vêm da cache e atualizam-se em fundo. A versão da cache é um hash do conteúdo e muda sozinha a cada deploy. Sem rede, o lobby mostra os jogos da última ligação e **o tutorial funciona offline**. Consola, `/admin` e WebSocket nunca ficam em cache.

**Protocolo** (cliente → servidor): `HELLO`, `SET_NAME`, `LIST`, `CREATE_SOLO`, `OPEN`, `CLOSE`, `JOIN`, `LEAVE`, `START`, `MOVE`, `RESTART`, `DELETE`, `PING`. O servidor responde com `WELCOME`, `ROOMS`, `ROOM`, `NOTICES` e `ERROR` (sempre com uma chave i18n).

**Avisos e atualizações**: `POST /admin/notices` anuncia uma atualização a todos os jogadores do deploy e pode abrir uma janela de manutenção (sem partidas novas de um jogo até ao deploy). Ver `docs/CONTRATO.md`.

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

Ver `examples/clean-runtime/`. A marca usa o design system da Bitnik como base e troca só os tokens. Os clientes têm repos separados; o motor entra como dependência com versão fixa.
