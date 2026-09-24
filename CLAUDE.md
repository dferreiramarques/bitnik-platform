# CLAUDE.md

Plataforma de jogos de tabuleiro online da Bitnik Games. Ler primeiro `README.md` e `docs/CONTRATO.md`.

## Contexto

- O David Marques é game designer e publisher (Bitnik Games).
- A plataforma tem duas faces:
  - **Bitnik Studio** (`apps/studio`): a instância da Bitnik, onde se criam, testam e aprovam jogos. A Forge entra aqui na Fase 1.
  - **Runtime** (`examples/clean-runtime`): um deploy por publisher cliente, que recebe só os pacotes de jogo vendidos. Os protótipos são aprovados no Studio e só depois de vendidos passam para o servidor do cliente.
- Cada jogo é um pacote versionado que só depende de `@bitnik/engine`. Os clientes têm repos separados; o motor entra como dependência com versão fixa.

## Estado e fases

- **Fase 0 (feita)**: engine, server, client SDK, Catania como primeiro pacote, Studio e runtime limpo.
- Catania 3.0.0: regra de "ronda completa" no fim do jogo, para equilibrar a vantagem do 1.º jogador a 2 jogadores.
- **Fase 0c (feita)**: consola em `/console` (painel, jogos com simulação, mesas de aprovação por convite, avisos), protegida por `ADMIN_TOKEN`.
- Fora do MVP: deploy público para partilhar o link das mesas de aprovação com clientes (as mesas funcionam localmente).
- **Fase 0b** (em curso): UI própria do Catania, por etapas: (1) infraestrutura da UI no pacote ✔; (2) tabuleiro do Catania ✔; (3) tutorial com o motor verdadeiro e cenários no pacote ✔; (4) "Aparência" na consola (tokens, temas, pré-visualização) ✔; (5) template vanilla no Figma, com variáveis com os mesmos nomes dos tokens do `skin.json` (`--table-bg`, …) para desenhar skins e temas e trocá-los em JSON; (6) service worker (PWA).
- **Fase 1**: Forge a gerar `rules.js` e testes a partir de cartões Gherkin.
- **Fase 2**: migrar Bulbous, Capivaras, Praia das Percebes e Nine Oils. Secção "Clientes" na consola quando houver runtimes em produção.

## Convenções

- ESM (`"type": "module"`), Node 18+.
- Código, comentários, commits e docs em **português de Portugal**.
- Todo o texto visível nos jogos sai de chaves i18n, com **PT e EN** e paridade de chaves (verificada por `checkGame`).
- Testes com `node:test` e `node:assert/strict`. Nos jogos, um teste por regra do `REGRAS.md` (modelo para o que o Forge vai gerar).
- Regras puras: sem rede, relógio nem `Math.random`. Aleatoriedade via `ctx.rng`, tempo via `ctx.schedule` + `events`.
- Decisões de arquitetura registadas em `docs/DECISOES.md`.

## Regra dos pacotes de jogo

Os ficheiros de um pacote em `games/*` só importam `@bitnik/engine` e ficheiros próprios (`./...`). Nada do servidor, do Studio ou de outros pacotes. Há um teste que verifica isto.

## Comandos

```bash
npm install
npm test
npm run simulate -- catania 1000
ADMIN_TOKEN=segredo npm run studio   # consola em /console
PORT=3001 npm run runtime
```
