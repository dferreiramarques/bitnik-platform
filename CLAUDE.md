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
- Catania 3.0.0: regra de "ronda completa" no fim do jogo. Catania 4.0.0: regra de abertura (no 1.º turno, a 2.ª recolha do 1.º jogador é de 1 carta), que tira a vantagem do 1.º lugar a 2, 3 e 4 jogadores (ver `games/catania/CHANGELOG.md`).
- **Fase 0c (feita)**: consola em `/console` (painel, jogos com simulação, mesas de aprovação por convite, avisos), protegida por `ADMIN_TOKEN`.
- Fora do MVP: deploy público para partilhar o link das mesas de aprovação com clientes (as mesas funcionam localmente).
- **Fase 0b** (em curso): UI própria do Catania, por etapas: (1) infraestrutura da UI no pacote ✔; (2) tabuleiro do Catania ✔; (3) tutorial com o motor verdadeiro e cenários no pacote ✔; (4) "Aparência" na consola (tokens, temas, pré-visualização) ✔; (5) template vanilla no Figma: preparação feita ✔ (`design/vanilla/skin.json`, `npm run figma`, `design/figma/TEMPLATE.md`); falta montar o ficheiro no Figma; (6) service worker (PWA) ✔.
- **Fase 1** (decisões ADR-009 a 013): Forge na consola do Studio, a gerar pacotes do contrato. Ordem: cartões → partida narrada (a IA joga uma partida em texto e marca dúvidas) → commit das regras → testes aprovados → código → verificação → protótipo 0.x no Studio → publicar como 1.0.0. Geração por copiar/colar com verificação automática; API opcional. Etapas: (1) Forge base: projetos no servidor, importar do Rule Forge (`bitnik-logic`), fluxo, cartões com categoria, regras; (2) partida narrada; (3) testes a partir dos cartões; (4) código e verificação isolada; (5) instalação a quente, versões e publicação; (6) geração pela API (opcional).
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
