# Roadmap

Estado das fases da plataforma e os passos de cada uma. É o único sítio onde o estado se atualiza; o `README.md` e o `CLAUDE.md` apontam para aqui.

Legenda: ✔ feito · ◐ em curso · ☐ por fazer.

Atualizado a 2026-10-02.

## Resumo

| Fase | Estado | Em poucas palavras |
|---|---|---|
| 0 | ✔ | Motor, servidor, SDK de cliente, Catania, Studio e runtime limpo |
| 0b | ✔ | UI própria do Catania e template vanilla |
| 0c | ✔ | Consola em `/console` (e em "/" no Studio, com `consoleAtRoot`); documentação em `/documentation` |
| 1 | ◐ | Forge na consola do Studio (falta a geração pela API, opcional) |
| 2 | ◐ | Migração dos jogos antigos (4 migrados, todos com UI própria; falta a secção "Clientes" na consola) |
| 3 | ☐ | Tabuleiros — proposta em `docs/TABULEIROS.md`, para começar depois da Fase 1 (o editor depende dos cartões do Forge) |
| 4 | ☐ | Plataforma multi-marca — ideia por desenhar, para comercializar o output a outras editoras |

## Fase 0 — Base ✔

- ✔ `@bitnik/engine`, `@bitnik/server` e `@bitnik/client`.
- ✔ Catania como primeiro pacote de jogo.
- ✔ Bitnik Studio (`apps/studio`) e runtime limpo (`examples/clean-runtime`).

Evolução do Catania nesta base (ver `games/catania/CHANGELOG.md`):

- **3.0.0**: regra de "ronda completa" no fim do jogo.
- **4.0.0**: regra de abertura (no 1.º turno, a 2.ª recolha do 1.º jogador é de 1 carta), que tira a vantagem do 1.º lugar a 2, 3 e 4 jogadores.
- **5.0.0**: as pilhas de recursos deixam de estar ordenadas; o disco que vem da torre vai para cima e passa a ser o valor, e valorizar tira o de cima (volta o valor anterior).

## Fase 0b — UI própria do Catania e template ✔

Por etapas:

1. ✔ Infraestrutura da UI no pacote.
2. ✔ Tabuleiro do Catania.
3. ✔ Tutorial com o motor verdadeiro e cenários no pacote.
4. ✔ "Aparência" na consola (tokens, temas, pré-visualização). Desde 2026-10-01, o fundo do lobby é sempre o `--table-bg` do jogo (escurecido, nenhum campo) e a miniatura na página da marca é um campo à parte (`thumbnail`, fora do skin.json — sobrepõe-se à do pacote, chega já pronta no WELCOME).
5. ✔ Template vanilla: preparação (`design/vanilla/skin.json`, `npm run figma`) e desenho montado no Claude Design, no canvas "Bitnik — Template vanilla" (<https://claude.ai/artifact/9yZPAYkg1bMhpgzWKrLgpX>): tokens, componentes, mesa no computador e no telemóvel, Início, Marca-produto, Lobby, Entrada, Fim e Relatório. Guião em `design/figma/TEMPLATE.md`; a mesa em ecrã inteiro ficou na ADR-014.
6. ✔ Service worker (PWA).

## Fase 0c — Consola ✔

- ✔ Consola em `/console`, protegida por `ADMIN_TOKEN`: painel, jogos com simulação, mesas de aprovação por convite e avisos.
- ✔ `consoleAtRoot` (2026-09-30): com este sinalizador (só com `ADMIN_TOKEN`), "/" passa a servir a consola e o lobby da marca muda para "/<brand.id>" — a plataforma é a ferramenta; o lobby é um output dela. Ligado só no Studio da Bitnik (`apps/studio/server.js`, arranque direto); `createPlatform()` mantém "/" como o lobby por omissão (nenhum teste nem o runtime cliente o usam).
- ✔ Documentação em `/documentation` (2026-09-30): página de referência do sistema de design (ao estilo shadcn/ui) — tokens (cores, tipografia, forma), os componentes do `bitnikgames-design-system` (botão, badge, cartão), as três camadas de customização (ADR-008) e os padrões de UI da mesa nascidos nos jogos migrados (vidro, cartão de jogador, controlo preso ao canto, modal de regras, faixa com fade, capa do lobby). Pública, sem `ADMIN_TOKEN`, independente do `consoleAtRoot`. `packages/server/public/documentation.{html,css,js}`.
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
| Capivaras | 2.0.0 ✔ | `games/capivaras` | Feitas pela Forge e publicadas; empate partilha a vitória. A 2.0.0 traz o baralho do jogo (o da arte) e UI própria no template |
| Praia das Percebes | 2.0.2 ✔ | `games/praia-das-percebes` | Colunas de 4 e 6 para tirar a vantagem do 2.º lugar (ver CHANGELOG); UI própria no template vanilla |
| Nine Oils | 1.1.13 ✔ | `games/nine-oils` | Só a 2; 2 Rapazes; UI própria no template vanilla — a partir de 2026-10-01, deixa de ser só a demonstração do vanilla "nu" (ver linha a seguir) e passa a evoluir para um jogo à parte: fundo customizado, melhores componentes e interação |
| Startup Panic | 1.0.0 ✔ | `games/startup-panic` | De `dferreiramarques/startup-panic`; 2 a 4 jogadores, classificação comercial: médio. Ordem de turno dinâmica no estado (ADR-017); troca no Gate como proposta com aceitação; corrigido o ciclo comprar+vender no Gate. UI própria no template; aprovado pelo David a 2026-10-02 e registado no Studio sem selo de protótipo |
| Nine Oils (Vanilla Demo) | 1.0.1 ✔ | `games/nine-oils-vanilla` | Cópia separada do Nine Oils em 1.1.13 (congelada), para continuar a mostrar o template vanilla tal como ficou desenhado no Claude Design — não recebe as mudanças de UX da linha acima. `hidden: true`: fora da página da marca, só por link direto (consola → Jogos → Abrir) |

Por fazer:

- ✔ Teste de encaixe: o Catania montado no template (computador, telemóvel e horizontal), no canvas; as peças que faltam estão na secção 5 do `design/figma/TEMPLATE.md`.
- ✔ Catania live no template (ADR-014): a plataforma passa a ter o modo mesa em ecrã inteiro para jogos com UI própria (linha de topo com marca, jogo, ficha de avisos a vermelho em manutenção, voltar e idioma; resultado em sobreposição) e a UI do Catania foi reescrita com painéis de vidro, pilhas e registo flutuantes, zoom (pinça, roda e botões) e variantes telemóvel vertical e horizontal. Afinações depois de jogar no telemóvel:
  - o tabuleiro já não se mexe quando os painéis mudam de altura;
  - a mesa abre em ecrã inteiro;
  - o cabeçalho ficou encostado ao topo;
  - os botões de zoom estão escondidos no telemóvel;
  - as páginas deixaram de usar `viewport-fit=cover`.
- ◐ UI genérica com o desenho do template (ADR-014):
  - ✔ Pendentes da secção 5 do `design/figma/TEMPLATE.md` resolvidos (contraste do vidro, alvos de toque, botão de informação; as peças que o Catania pediu ficaram num quadro novo, "Vanilla: peças que faltam").
  - ✔ Mesa em ecrã inteiro para jogos sem UI própria (Bulbous, Praia, Nine Oils): sem tabuleiro, mas com os mesmos painéis de vidro (jogadores, jogadas, registo colapsável).
  - ✔ "Copiar convite" em qualquer mesa (não só nas de aprovação): já estava feito na Entrada, para qualquer mesa que não seja solo.
  - ✔ Mensagens da mesa: mecanismo da plataforma feito (fila, animação, "É a tua vez") e ligado à UI genérica; Catania e Capivaras já usam o mesmo mecanismo pelo `ctx.announce` (sem cópia própria). O `CONTRATO.md` ganhou `ctx.log(key, params, { announce })`, com uma forma curta (reutiliza a chave do registo) e uma com texto próprio (`{ variant, key, params }`), para quando a frase do registo é longa de mais para a mesa. Adotado nos três jogos sem UI própria, num momento raro e marcante de cada um: Bulbous "Última ronda!" (quando entra a última Baelfungious), Praia "Objetivo cumprido!" (só 8 no baralho) e Nine Oils "Penta!" (~5% dos lançamentos, o adversário descarta a mão). O fim do jogo nunca leva mensagem própria: coincide sempre com o resultado, que já mostra o vencedor.
  - ✔ Componentes como alvo: decidido não fazer como peça genérica do contrato (2026-09-28) — só o Nine Oils precisaria e a lista de jogadas já é clara, ainda por cima às cegas (não há nada visível para mostrar). Resolvido só com CSS: os botões de "tirar às cegas" (`data-type="ESCOLHA_CEGA"`) parecem cartas viradas para baixo com o número, mantendo o texto completo para leitores de ecrã.
  - Pontos por origem no fim/relatório: adiado. Não é uma peça do contrato para todos os jogos; só se um jogo concreto precisar (ex.: Bulbous) implementa-se à parte, nesse jogo.
- ✔ UIs próprias de cada jogo, no template:
  - ✔ Catania;
  - ✔ Capivaras (2.0.0): cartas ilustradas ao centro, revelação com quem apostou em cada carta, nenúfares e pássaro;
  - ✔ Nine Oils (1.1.7): sem tokens próprios (skin.json é uma cópia do vanilla), para mostrar a clientes o aspeto de base da plataforma — banca de 6 casas (🧪 garrafa), mão com a arte da carta em dobro (❤️‍🔥👦🏽💪🏼), dados animados, escolha às cegas como cartas viradas para baixo, sem pausa manual a "ver os dados";
  - ✔ Praia das Percebes (2.0.4): tabuleiro a sério com zoom e arrastar (como o Catania), objetivos em cartões com o nome, salva-vidas marcados na peça, vento decorativo na praia; peças/objetivos/marcador pela convenção de componentes reutilizáveis (`--card-*`/`--token-*`), sem arte publicada ainda (emoji); mesa em degradê de céu/areal, inspirada no jogo online antigo — só o `skin.json` do jogo mudou, não o vanilla;
  - ✔ Bulbous (1.1.1): conversão 1:1 do visual do jogo antigo (repositório `bulbous`) — fundo quase-preto, roxo brilhante em destaque, as 4 cores de bolbo, e as 50 imagens do jogo antigo (16 Baelfungious + 34 cartas de charme, `public/cards/*.webp`) trazidas para `ui/cards/`; bolbos colocados desenham-se por cima da arte, na cor de quem os pôs, nas posições medidas no jogo antigo. Emoji de recuo só se uma imagem faltar. Escolher/declarar sequência/apostar/trocar/descartar/desempatar têm interação própria (clique direto ou seleção de cartas + confirmar), sem depender de `msg.legal` para Apostar (exponencial em subconjuntos da mão).
- ✔ Pontos "para rever" de cada `CHANGELOG.md` e vantagens de lugar de `docs/EQUILIBRIO.md` (2026-09-29): Nine Oils testado por simulação (2ª carta ou 0 cartas para quem começa não resolvem o desequilíbrio — fica simétrico, 1 carta cada) e o resto fechado ou já resolvido em versões anteriores.
- ☐ Secção "Clientes" na consola, quando houver runtimes em produção.
- ☐ Nine Oils, visual e interação a sério (2026-10-01): separado em `games/nine-oils-vanilla` o que estava (skin do vanilla "nu", para continuar a mostrar o template a clientes); o pacote `nine-oils` fica livre para um fundo customizado, melhores componentes e melhor UX, por fazer.

## Fase 3 — Tabuleiros ☐

Proposta validada em conversa (2026-09-29), detalhe completo em `docs/TABULEIROS.md` (resumo também no `CONTRATO.md`). Um jogo poderá trazer `boards`: tipos Mesa, Grelha, Relativo, Arena, Puzzle ou Táctico, todos (exceto a Mesa) reduzidos ao mesmo modelo de localizações (nós) e ligações (arestas), com custos resolvidos na compilação e as regras nunca a ler a arte. Componentes do Forge podem ocupar uma localização (`pieces[]`), com ações e estado próprios — só colocação `snap` a um nó por agora, colocação livre com colisão adiada (2026-09-29). Editores no Studio, não importação de ferramentas externas: Componentes (novo) e Tabuleiro/mesa de jogo (novo), além da Aparência já existente.

Por fazer, por esta ordem provável:

- ☐ Decisões em aberto (secção 8 do documento): `legal(state, seat)` no contrato (mudança major), movimento em passos vs. atómico, que regras espaciais entram no motor, cache de distâncias, vocabulário espacial nos cartões Gherkin, ordem de implementação dos tipos, formato do cartão de componente, motor de colisão para quando a colocação livre deixar de estar adiada.
- ☐ Começa depois da Fase 1 (o editor depende dos cartões do Forge).
- ☐ Jogo de validação para o tipo Táctico (o mais completo: estado, buffs, slots de material, zonas).

## Fase 4 — Plataforma multi-marca (comercializar a outros publishers) ☐

Ideia (2026-09-30), ainda por desenhar: hoje `createPlatform()` só conhece uma marca por processo (o runtime de cada cliente é um deploy à parte, `examples/clean-runtime`). Para vender o output da plataforma a outras editoras sem um deploy novo por cliente, o mesmo processo do Studio precisaria de servir várias marcas em simultâneo — `/<brand.id>` para cada uma, todas geridas a partir da mesma consola em "/".

Isto é bem maior do que o `consoleAtRoot` da Fase 0c: hoje as mesas, o `storage` e os jogos instalados são um único estado por processo; multi-marca implica isolar esse estado por marca (mesas, protótipos, aparência, storage), e decidir o que se partilha entre marcas (ex.: os jogos aprovados) e o que não (ex.: mesas, tokens de aparência). Por fazer, ainda sem ordem:

- ☐ Desenhar o modelo de dados: o que é por-marca vs. partilhado.
- ☐ Consola: gerir várias marcas (criar, listar, apagar), não só os jogos de uma.
- ☐ Isolar `storage` por marca (hoje é um `fileStorage`/`memoryStorage` só).
- ☐ Decidir como uma marca nova ganha jogos: todos os aprovados por omissão, ou por marca?
- ☐ Faturação/limites, se isto vier a ser vendido como serviço.
