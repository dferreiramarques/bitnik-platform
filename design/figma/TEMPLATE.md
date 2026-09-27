# Template vanilla

Ficheiro base de desenho dos jogos da Bitnik. Está montado no Claude Design, no canvas **"Bitnik — Template vanilla"** (<https://claude.ai/artifact/9yZPAYkg1bMhpgzWKrLgpX>, privado), e é a referência para jogos novos e para a UI genérica.

Os tokens têm **os mesmos nomes** dos da plataforma (`design/vanilla/skin.json`), por isso o que se desenha entra na consola sem tradução (ADR-008). A mesa ocupa o ecrã inteiro e os painéis são de vidro por cima dela (ADR-014).

## 1. Quadros do canvas

| Linha | Quadro | Tamanho | O que mostra |
|---|---|---|---|
| Tokens | Tokens (skin vanilla) | 1280 × 800 | Mesa, base, destaque, jogadores, letra e forma |
| | Componentes base | 1280 × 800 | Ver secção 4 |
| Mesa | Mesa — computador | 1280 × 800 | Ver secção 3 |
| | Mesa — telemóvel | 390 × 844 | Ver secção 3 (zoom com dois dedos no modo Play) |
| | Mesa — telemóvel na horizontal | 844 × 390 | Ver secção 3 |
| Fora da mesa | Lobby do jogo | 1280 × 800 | A tua mesa contra bots, mesas com outras pessoas, mesa de aprovação |
| | Entrada na mesa | 1280 × 800 | Lugares (tu, outros, livres), Começar, Como se joga, Copiar convite |
| | Fim do jogo e resultados | 1280 × 800 | Classificação com a origem dos pontos, empate partilhado, Jogar outra vez, Relatório |
| | Relatório do jogo | 1280 × 800 | De onde vêm os pontos (por jogador) e momentos decisivos por ronda |
| Entrada da marca | Início (marca com vários jogos) | 1280 × 800 | Marca, nome do jogador e uma grelha de jogos que leva ao lobby de cada um |
| | Marca-produto (um só jogo) | 1280 × 800 | "[MARCA] apresenta [jogo]", nome do jogador, a tua mesa e as mesas com outras pessoas no mesmo ecrã |
| Telemóvel | Início, Lobby, Entrada, Fim, Relatório, Marca-produto | 390 × 844 | Os mesmos ecrãs numa coluna |
| Teste de encaixe | Catania no template: computador, telemóvel, telemóvel na horizontal e "o que falta" | vários | O Catania montado com esta estrutura, com as suas cores e o mar; ver secção 5 |

Os textos entre parênteses retos (`[MARCA]`, `[Nome do jogo]`, `[uma frase curta]`) são para substituir; tudo o resto é texto final.

## 2. Tokens

`npm run figma` gera `design/figma/*.tokens.json` (formato W3C Design Tokens, DTCG) para importar como Variables:

| Ficheiro | Coleção | Modo |
|---|---|---|
| `brand.tokens.json` | Brand | Bitnik |
| `vanilla.tokens.json` | Vanilla | Default |
| `catania.default.tokens.json` | Catania | Default |
| `catania.dia.tokens.json` | Catania | Dia |

Cada ficheiro de jogo é um **modo** da mesma coleção: um tema novo é um modo novo. Não mudes o `$extensions.bitnik.token` de cada variável: é o que liga a variável ao token CSS na volta.

Grupos do vanilla:

- **Mesa** (`table`): `--table-bg` (fundo, gradiente radial verde; o único obrigatório), `--table-dots` (a grelha de pontos por cima), `--game-glass`, `--game-glass-line` e `--game-glass-blur` (painéis de vidro), `--game-on-table`, `--game-on-table-muted`, `--game-on-table-accent` ("a pensar…", ligações) e `--game-on-table-warn` ("Última ronda!").
- **Base** (`base`): painéis claros (`--game-panel`, `--game-panel-2`, `--game-line`), texto (`--game-text`, `--game-muted`), destaque (`--game-accent`, `--game-on-accent`, `--game-accent-strong` para texto de destaque e hover), `--game-danger` e desativado (`--game-disabled-bg`, `--game-disabled-line`, `--game-disabled-text`).
- **Jogadores** (`players`): `--game-color-1..4`.
- **Letra** (`type`): `--game-font-display` (Baloo 2, 700/800) e `--game-font-body` (Inter, 400/600).
- **Forma** (`shape`): `--game-radius` (14 px, cartões grandes). Os painéis de vidro usam 8–12 px e os botões 7–9 px.

Na plataforma, o Início é a página principal (`/`) quando o deploy tem mais de um jogo; cada cartão abre o lobby do jogo (`#/j/<jogo>`) e o "voltar" da mesa leva a esse lobby. O fundo usa a cor da marca (`--brand-primary`/`--brand-secondary`; no Bitnik, o laranja) em vez do verde do quadro. Com um só jogo, `/` é o lobby desse jogo. O lobby de cada jogo segue o quadro "Lobby" com o mesmo fundo: a tua mesa contra bots (escolher quantos bots, "Continuar · ronda N" e "Nova"), as mesas com outras pessoas em cartões com um ponto por lugar, e as partidas anteriores numa lista; o cartão "Contra bots" ocupa a linha toda. A mesa à espera de jogadores segue o quadro "Entrada" (lugares ocupados e livres, "Começar", "Como se joga", "Copiar convite"), no mesmo fundo; ao começar passa à mesa do jogo. O nome da marca fica a branco.

As capas dos jogos no Início usam um gradiente de 135° da cor do jogo para uma versão mais escura (ex.: `#1a5276` → `#10324a`). São marcadores de lugar: na versão final entra a arte de cada jogo.

## 3. A mesa

A mesa ocupa o ecrã inteiro (`--table-bg` com `--table-dots` por cima). Não há barra, título nem moldura da plataforma: tudo o resto flutua em painéis de vidro.

```
┌─ [MARCA] · [Nome do jogo] · Mesa de 4 ─────────────────────── (?) (←) EN ─┐
│          ┌ ANA 24 ┐ ┌ RUI 19 ┐ ┌ BOT 2 12 ┐ ┌ BOT 3 15 ┐          jogadores   │
│                  (Ronda 3) (Última ronda) (+1 carta)              fichas     │
│         ┌ - - - - - - - - - - - - - - - - - - - - - - ┐                     │
│         │                                             │     PAINEL DO JOGO  │
│         │   Tabuleiro, centrado no ecrã               │        [Mercado] (3)│
│         │   «É a tua vez»                             │      [Objetivos] (2)│
│         │                                             │        [Baralho](24)│
│         └ - - - - - - - - - - - - - - - - - - - - - - ┘                     │
│ REGISTO ▾            ┌ A MINHA ÁREA ┐                               [✥]    │
│ Ana recolheu…        │ ▭ ▭ ▭ ⬚       │                               [+]    │
│                      └──────────────┘                               [−]    │
│               [Ação principal] [Outra ação] [Passar]                [▢]    │
└──────────────────────────────────────────────────────────────────────────────┘
```
- **Topo à esquerda**: marca, nome do jogo e tamanho da mesa, em `--game-on-table` a 78%.
- **Topo à direita**: Guia (tutorial), Voltar ao lobby e a língua.
- **Jogadores**: um cartão de vidro por jogador, com o ponto da cor, o nome em maiúsculas, os pontos, o estado e os **componentes** (Cartas 5, Tokens 2…). Os componentes são botões: servem de alvo quando uma ação escolhe um jogador (roubar uma carta, tirar um token). O jogador da vez tem contorno `--game-accent` e o estado em `--game-on-table-accent`.
- **Fichas da ronda**: ronda, "Última ronda" (fundo `--game-accent`) e avisos curtos do jogo.
- **Tabuleiro**: mesa infinita; arrasta para mover, roda (ou dois dedos) para aproximar. Fica **centrado no ecrã**, na horizontal e na vertical (no vanilla, 868 × 400 em (206, 200)); as fichas da ronda ficam a meio do espaço entre os jogadores e o tabuleiro.
- **Mensagem da mesa**: ver secção 4.
- **A minha área**: mão e peças do jogador, em baixo ao centro.
- **Barra de ações**: em baixo ao centro; ação principal em `--game-accent`, as outras em vidro.
- **Registo**: em baixo à esquerda, **flutuante**: sem fundo nem contorno, só texto com sombra (`0 1px 3px rgba(0,0,0,.7), 0 0 12px rgba(0,0,0,.4)`) para se ler em cima da mesa. No telemóvel dobra-se dentro de "A minha área" (REGISTO ▴).
- **Painel do jogo**: informação partilhada do jogo (pilhas, mercado, objetivos, baralho), à direita, flutuante como o registo, alinhado à direita, a 48 px da margem do ecrã e centrado na vertical com o tabuleiro. No telemóvel é uma ficha "Painel ▾" que abre; na horizontal é uma coluna compacta à direita.
- **Controlos da vista**: em baixo à direita (mover, aproximar, afastar, ver tudo).

No telemóvel (390 × 844): topo com voltar, nome do jogo, guia e língua; os jogadores numa faixa com a altura de um cartão (148 px de largura cada, o 3.º a espreitar à direita), com scroll horizontal: os restantes veem-se com swipe, sem botão "+N" nem ecrã por cima; quando a vez muda, a faixa mostra quem joga; fichas a meio entre os jogadores e o tabuleiro; tabuleiro centrado na vertical; a minha área; barra de ações em grelha 2:1:1.

No telemóvel, o tabuleiro aproxima-se com **dois dedos** e move-se com um. Os botões +, − e "ver tudo" (44 px) aparecem só nas mesas maiores; no telemóvel, na vertical e na horizontal, ficam no layout mas escondidos, para não taparem o tabuleiro. A roda do rato aproxima no computador. O zoom vai de 50% a 300% e fica centrado entre os dedos.

No telemóvel, ao entrar numa mesa ou no tutorial, a página passa a **ecrã inteiro** e esconde a barra de endereço. O browser só o permite num toque: no botão que entra na mesa ou, se se chegou por um link, no primeiro toque na mesa. Ao voltar ao lobby, sai do ecrã inteiro. No iPhone o Safari não tem ecrã inteiro para páginas: aí usa-se "Adicionar ao ecrã principal", que abre sem barra de endereço. O cabeçalho da mesa fica encostado ao topo.

**Camadas.** O tabuleiro não fica preso a uma janela: ocupa o ecrã inteiro, entre o fundo e a UI.

| Camada | Conteúdo |
|---|---|
| Fundo | `--table-bg` e `--table-dots` |
| Tabuleiro | tabuleiro e peças, com mover e zoom em qualquer ponto livre do ecrã |
| UI | jogadores, fichas, painel do jogo, registo, a minha área, barra de ações e controlos da vista |

- Com "ver tudo" (e no início) o tabuleiro encaixa na **zona livre**, entre os jogadores e a minha área, como nos quadros. Ao aproximar ou mover, passa por baixo dos painéis de vidro. A zona livre é medida uma vez e fica fixa: os painéis que crescem e encolhem (ações, a minha área, o registo) não mexem o tabuleiro. Só volta a medir quando o ecrã muda de tamanho (rodar o telemóvel, redimensionar a janela) ou no botão de encaixar.
- Os contentores da UI deixam passar o rato e o toque para o tabuleiro; só os painéis e os botões os apanham. O que está por baixo de um painel não se toca através dele: move-se o tabuleiro para o destapar.
- Ao mover, fica sempre um pedaço do tabuleiro no ecrã (60 px), para não se perder.
- No computador largo (≥ 1200 px), os controlos da vista ficam no canto inferior direito do ecrã, ao lado da barra de ações.
- As disposições (telemóvel ≤ 760 px, horizontal com altura ≤ 500 px, largo ≥ 1200 px) seguem o **tamanho da mesa**, não o do ecrã (container queries): a mesma UI serve o ecrã inteiro, o tutorial e a pré-visualização da consola.

No telemóvel **na horizontal** (844 × 390): linha de cima com voltar, nome do jogo, fichas, guia e língua; jogadores numa coluna à esquerda (176 px); painel do jogo numa coluna compacta à direita, com os botões de zoom por baixo; tabuleiro ao centro (500 × 262); a minha área em baixo à esquerda e a barra de ações em baixo à direita.

## 4. Componentes base

| Componente | Variantes | Tokens |
|---|---|---|
| Botão | primário, secundário, informação (contorno tracejado), desativado | `game-accent`, `game-on-accent`, `game-panel-2`, `game-line`, `game-accent-strong`, `game-disabled-*` |
| Carta / peça | com nome e quantidade (×3), vazia (tracejada) | `game-panel-2`, `game-line`, `game-muted` |
| Jogador | da vez, à espera, bot; componentes como botões | `game-color-n`, `game-accent`, `game-panel`, `game-line` |
| Disco / marcador | normal, alerta | `game-panel-2`, `game-color-n`, `game-danger` |
| Painel | registo | `game-panel`, `game-line`, `game-muted` |
| Registo e painel do jogo (flutuantes) | sem fundo; texto com sombra, alinhado à esquerda (registo) ou à direita (painel) | `game-on-table`, `game-on-table-muted` |
| Controlos da vista | aproximar, afastar, ver tudo (44 px) | `game-glass`, `game-on-table` |
| Modal | título, texto, 2 botões | `game-panel`, `game-line`, `game-accent` |
| Tutorial | alvo com contorno, balão com passo, título e Seguinte | `game-panel`, `game-accent` |
| Mensagem da mesa | vez, evento com subtítulo, aviso (cor `game-on-table-warn`), fim | `game-on-table`, `game-font-display` |
| Campo do nome | 48 px, centrado, fundo claro sobre a mesa (igual no computador e no telemóvel), contorno `game-accent` com halo | `game-panel`, `game-text`, `game-accent` |

**Mensagem da mesa**: aparece no meio do tabuleiro, cresce e desaparece (cerca de 2,5 s), não bloqueia cliques e aparece uma de cada vez (as seguintes esperam). O jogo manda o texto e a variante. Com `prefers-reduced-motion`, aparece e desaparece sem crescer.

Letras: `game-font-display` para títulos, pontos e mensagens; `game-font-body` para o resto. Contraste mínimo **4,5:1** entre texto e fundo; a consola avisa para os pares da lista `contrast` do `skin.json`.

## 5. Pendentes

Pontos por resolver antes de a UI genérica usar este desenho (medidos no canvas a 2026-09-26):

- **Contraste do vidro.** O vidro claro (`--game-glass`, creme a 30%) clareia o verde e baixa o contraste do texto creme. No centro da mesa: texto 3,1:1, texto secundário 2,4:1, "a pensar…" 2,5:1. Proposta: vidro escuro, `rgba(20,32,26,.35)` com o mesmo desfoque (8,5 / 6,2 / 6,8:1). O teste do Catania confirmou a ideia: com o painel do Catania a 62% passa (texto 10,9:1, secundário 4,9:1, dourado 5,8:1).
- **Alvos de toque.** Os componentes do jogador têm 18–20 px, os botões de vidro 28–32 px e a barra de ações 32 px (40 no telemóvel). O mínimo é 44 px; nos componentes, a área de toque pode crescer sem mudar o desenho. Os quadros do Catania já usam 44 px na barra de ações e nos controlos da vista.
- **Destaque sobre o realce.** `--game-accent` sobre `--game-panel-2` dá 4,26:1; o botão de informação já usa `--game-accent-strong` (7,6:1).
- **Figma.** O gradiente da mesa, os valores `rgba()`, as letras (pilha CSS) e o raio (`"14px"`) não se ligam diretamente a Variables do Figma. O canvas do Claude Design não tem este problema; se o template for para o Figma, o export (`tools/figma.js`) tem de mandar cor sólida, nome da família e número.
- **Plataforma.** A mesa em ecrã inteiro, a mensagem da mesa, os componentes como alvo, a entrada da marca (Início ou Marca-produto), o "Copiar convite" de qualquer mesa e os pontos por origem no fim e no relatório ainda não existem na UI genérica nem no contrato (ver ADR-014).

O teste de encaixe do Catania mostrou mais quatro peças que faltam ao vanilla:

- **Componentes com ícone e cor**: o Catania mostra 5 recursos com ícone e as aldeias com a cor do recurso; o template só tem chips de texto ("Cartas 5").
- **Alvo no tabuleiro**: o estado "pode escolher" (contorno e brilho do destaque) e o modo de escolha na barra de ações ("toca num território…" e Cancelar).
- **Barra de ações com passo e motivo**: o passo da vez ("1.ª recolha") e porque uma ação está desativada ("precisas de 5 cartas").
- **Modal de escolha**: escolher entre várias opções com estado (manter, valorizar) e um resumo antes de confirmar; o modal do template só tem texto e dois botões.
- **Grupo de tokens "recursos"**: o vanilla não tem; o Catania define 6 cores `--cat-res-*`.

## 6. Da mesa desenhada ao jogo

- **Só cores, letras, imagens** → exporta as variáveis (DTCG) e usa **Consola › Aparência › Importar JSON**. Entram só os valores que mudaste; o modo exportado passa a ser o tema.
- **Design à medida** (arte, formas, layout) → um tema do pacote: `ui/themes/<nome>/theme.json` (valores dos tokens) + `theme.css`, com todas as regras a começar por `[data-game="<jogo>"]`.
- Imagens de fundo: WebP ou PNG até 300 KB para carregar pela consola; maiores vão para o pacote do jogo, em `ui/`.
