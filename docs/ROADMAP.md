# Roadmap

Estado das fases da plataforma e os passos de cada uma. É o único sítio onde o estado se atualiza; o `README.md` e o `CLAUDE.md` apontam para aqui.

Legenda: ✔ feito · ◐ em curso · ☐ por fazer.

Atualizado a 2026-09-26.

## Resumo

| Fase | Estado | Em poucas palavras |
|---|---|---|
| 0 | ✔ | Motor, servidor, SDK de cliente, Catania, Studio e runtime limpo |
| 0b | ✔ | UI própria do Catania e template vanilla |
| 0c | ✔ | Consola em `/console` |
| 1 | ◐ | Forge na consola do Studio (falta a geração pela API, opcional) |
| 2 | ◐ | Migração dos jogos antigos (4 migrados; UI genérica com o novo template e UIs próprias por fazer) |

## Fase 0 — Base ✔

- ✔ `@bitnik/engine`, `@bitnik/server` e `@bitnik/client`.
- ✔ Catania como primeiro pacote de jogo.
- ✔ Bitnik Studio (`apps/studio`) e runtime limpo (`examples/clean-runtime`).

Evolução do Catania nesta base (ver `games/catania/CHANGELOG.md`):

- **3.0.0**: regra de "ronda completa" no fim do jogo.
- **4.0.0**: regra de abertura (no 1.º turno, a 2.ª recolha do 1.º jogador é de 1 carta), que tira a vantagem do 1.º lugar a 2, 3 e 4 jogadores.

## Fase 0b — UI própria do Catania e template ✔

Por etapas:

1. ✔ Infraestrutura da UI no pacote.
2. ✔ Tabuleiro do Catania.
3. ✔ Tutorial com o motor verdadeiro e cenários no pacote.
4. ✔ "Aparência" na consola (tokens, temas, pré-visualização).
5. ✔ Template vanilla: preparação (`design/vanilla/skin.json`, `npm run figma`) e desenho montado no Claude Design, no canvas "Bitnik — Template vanilla" (<https://claude.ai/artifact/9yZPAYkg1bMhpgzWKrLgpX>): tokens, componentes, mesa no computador e no telemóvel, Início, Marca-produto, Lobby, Entrada, Fim e Relatório. Guião em `design/figma/TEMPLATE.md`; a mesa em ecrã inteiro ficou na ADR-014.
6. ✔ Service worker (PWA).

## Fase 0c — Consola ✔

- ✔ Consola em `/console`, protegida por `ADMIN_TOKEN`: painel, jogos com simulação, mesas de aprovação por convite e avisos.
- Fora do MVP: deploy público para partilhar o link das mesas de aprovação com clientes (as mesas funcionam localmente).

## Fase 1 — Forge ◐

Decisões ADR-009 a ADR-013 (`docs/DECISOES.md`). A Forge vive na consola do Studio e gera pacotes do contrato.

Ordem do fluxo: cartões → partida narrada (a IA joga uma partida em texto e marca dúvidas) → commit das regras → testes aprovados → código → verificação → protótipo 0.x no Studio → publicar como 1.0.0. Geração por copiar/colar com verificação automática; API opcional.

Etapas:

1. ✔ **Forge base**: projetos no servidor, importar do Rule Forge (`bitnik-logic`), fluxo (editor com anular, organizar, minimapa e painel do bloco), cartões com categoria, regras.
2. ✔ **Partida narrada**: prompt para copiar, colar a resposta, linha do tempo com dúvidas, aprovar, commit das regras 0.x.
3. ✔ **Testes a partir dos cartões**: modelo do estado a partir dos blocos DATA, um teste por cartão de regra e por partida aprovada, aprovados fixos.
4. ✔ **Código e verificação isolada**:
   - ✔ harness: `packages/server/src/verify.js` + `verify-runner.mjs`, processo com `--permission`, `POST /admin/forge/<projeto>/verify` guarda `project.build`;
   - ✔ separador "Código": prompt do pacote, colar os ficheiros, relatório, prompt de correção.
5. ✔ **Instalação a quente, versões e publicação**:
   - ✔ **5a**: botão "Instalar protótipo" no separador Código; pacote gravado em `<DATA_DIR>/prototipos/<projeto>/<versão>-<marca>/`, carregado sem reiniciar e de novo no arranque; selo "protótipo" no lobby e na consola.
   - ✔ **5b**: cada partida fica presa à versão do protótipo com que começou; as versões anteriores ficam carregadas enquanto houver mesas e saem na instalação seguinte.
   - ✔ **5c**: botão "Publicar como 1.0.0": verifica outra vez e grava `games/<id>/` com código, testes aprovados, `REGRAS.md`, `CHANGELOG.md` e `package.json`. Não mexe no Git: rever, juntar ao `apps/studio/server.js` e fazer commit à mão.
6. ☐ **Geração pela API** (opcional).

## Fase 2 — Migração dos jogos ◐

Migração direta do código antigo, um jogo de cada vez.

| Jogo | Versão | Pasta | Notas |
|---|---|---|---|
| Bulbous | 1.0.0 ✔ | `games/bulbous` | Motor 0.2.1 com `players.counts`, porque se joga a 2 ou 4 |
| Capivaras | 1.0.0 ✔ | `games/capivaras` | Feitas pela Forge e publicadas; empate partilha a vitória |
| Praia das Percebes | 2.0.0 ✔ | `games/praia-das-percebes` | Colunas de 4 e 6 para tirar a vantagem do 2.º lugar (ver CHANGELOG) |
| Nine Oils | 1.1.0 ✔ | `games/nine-oils` | Só a 2; 2 Rapazes |

Por fazer:

- ☐ UI genérica com o desenho do template (ADR-014): antes, resolver os pendentes da secção 5 do `design/figma/TEMPLATE.md` (contraste do vidro, alvos de toque, campo do nome) e acrescentar ao `CONTRATO.md` as mensagens da mesa e o relatório do fim.
- ☐ UIs próprias de cada jogo (hoje todos usam a UI genérica de protótipo).
- ☐ Pontos "para rever" de cada `CHANGELOG.md` (iteração seguinte). Vantagens de lugar por confirmar em `docs/EQUILIBRIO.md`.
- ☐ Secção "Clientes" na consola, quando houver runtimes em produção.
