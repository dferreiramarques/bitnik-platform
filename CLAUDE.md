# CLAUDE.md

Plataforma de jogos de tabuleiro online da Bitnik Games. Ler primeiro `README.md`, `docs/CONTRATO.md` e `docs/ROADMAP.md`.

## Contexto

- O David Marques é game designer e publisher (Bitnik Games).
- A plataforma tem duas faces:
  - **Bitnik Studio** (`apps/studio`): a instância da Bitnik, onde se criam, testam e aprovam jogos. A Forge vive aqui.
  - **Runtime** (`examples/clean-runtime`): um deploy por publisher cliente, que recebe só os pacotes de jogo vendidos. Os protótipos são aprovados no Studio e só depois de vendidos passam para o servidor do cliente.
- Cada jogo é um pacote versionado que só depende de `@bitnik/engine`. Os clientes têm repos separados; o motor entra como dependência com versão fixa.

## Estado e fases

- Feitas: Fase 0 (motor, servidor, SDK, Catania, Studio e runtime limpo) e Fase 0c (consola em `/console`).
- Em curso: Fase 0b (falta montar o template vanilla no Figma), Fase 1 (Forge completa até à publicação; falta a geração pela API, opcional) e Fase 2 (Bulbous, Capivaras, Praia das Percebes e Nine Oils migrados, com UI genérica).
- Detalhe de cada fase e etapa, e o que falta: `docs/ROADMAP.md`. Ao fechar uma etapa, atualizar lá (e aqui só se mudar o resumo).

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
