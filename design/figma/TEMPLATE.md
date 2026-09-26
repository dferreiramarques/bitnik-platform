# Template vanilla

Ficheiro base de desenho dos jogos da Bitnik. Está montado no Claude Design, no canvas **"Bitnik — Template vanilla"** (<https://claude.ai/artifact/9yZPAYkg1bMhpgzWKrLgpX>, privado), e é a referência para jogos novos e para a UI genérica.

Os tokens têm **os mesmos nomes** dos da plataforma (`design/vanilla/skin.json`), por isso o que se desenha entra na consola sem tradução (ADR-008). A mesa ocupa o ecrã inteiro e os painéis são de vidro por cima dela (ADR-014).

## 1. Quadros do canvas

| Linha | Quadro | Tamanho | O que mostra |
|---|---|---|---|
| Tokens | Tokens (skin vanilla) | 1280 × 800 | Mesa, base, destaque, jogadores, letra e forma |
| | Componentes base | 1280 × 800 | Ver secção 4 |
| Mesa | Mesa — computador | 1280 × 800 | Ver secção 3 |
| | Mesa — telemóvel | 390 × 844 | Ver secção 3 |
| Fora da mesa | Lobby do jogo | 1280 × 800 | A tua mesa contra bots, mesas com outras pessoas, mesa de aprovação |
| | Entrada na mesa | 1280 × 800 | Lugares (tu, outros, livres), Começar, Como se joga, Copiar convite |
| | Fim do jogo e resultados | 1280 × 800 | Classificação com a origem dos pontos, empate partilhado, Jogar outra vez, Relatório |
| | Relatório do jogo | 1280 × 800 | De onde vêm os pontos (por jogador) e momentos decisivos por ronda |
| Entrada da marca | Início (marca com vários jogos) | 1280 × 800 | Marca, nome do jogador e uma grelha de jogos que leva ao lobby de cada um |
| | Marca-produto (um só jogo) | 1280 × 800 | "[MARCA] apresenta [jogo]", nome do jogador, a tua mesa e as mesas com outras pessoas no mesmo ecrã |
| Telemóvel | Início, Lobby, Entrada, Fim, Relatório, Marca-produto | 390 × 844 | Os mesmos ecrãs numa coluna |

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

As capas dos jogos no Início usam um gradiente de 135° da cor do jogo para uma versão mais escura (ex.: `#1a5276` → `#10324a`). São marcadores de lugar: na versão final entra a arte de cada jogo.

## 3. A mesa

A mesa ocupa o ecrã inteiro (`--table-bg` com `--table-dots` por cima). Não há barra, título nem moldura da plataforma: tudo o resto flutua em painéis de vidro.

```
┌─ [MARCA] · [Nome do jogo] · Mesa de 4 ─────────────── (?) (←) EN ─┐
│        ┌ ANA 24 ┐ ┌ RUI 19 ┐ ┌ BOT 2 12 ┐ ┌ BOT 3 15 ┐                 │
│        │a pensar│ │jogou 3 │ │ à espera │ │  passou  │   jogadores     │
│        │[Cartas]│ │[Cartas]│ │ [Cartas] │ │ [Cartas] │                 │
│              (Ronda 3) (Última ronda) (+1 carta)          fichas       │
│        ┌ - - - - - - - - - - - - - - - - - - - - - - ┐                 │
│        │     Tabuleiro (mesa infinita, zoom)          │                 │
│        │           «É a tua vez»                      │                 │
│        └ - - - - - - - - - - - - - - - - - - - - - - ┘                 │
│ REGISTO              ┌ A MINHA ÁREA ┐                         [✥]     │
│ Ana recolheu…        │ ▭ ▭ ▭ ⬚       │                         [+]     │
│                      └──────────────┘                         [−]     │
│              [Ação principal] [Outra ação] [Passar]           [▢]     │
└──────────────────────────────────────────────────────────────────────┘
```

- **Topo à esquerda**: marca, nome do jogo e tamanho da mesa, em `--game-on-table` a 78%.
- **Topo à direita**: Guia (tutorial), Voltar ao lobby e a língua.
- **Jogadores**: um cartão de vidro por jogador, com o ponto da cor, o nome em maiúsculas, os pontos, o estado e os **componentes** (Cartas 5, Tokens 2…). Os componentes são botões: servem de alvo quando uma ação escolhe um jogador (roubar uma carta, tirar um token). O jogador da vez tem contorno `--game-accent` e o estado em `--game-on-table-accent`.
- **Fichas da ronda**: ronda, "Última ronda" (fundo `--game-accent`) e avisos curtos do jogo.
- **Tabuleiro**: mesa infinita; arrasta para mover, roda (ou dois dedos) para aproximar.
- **Mensagem da mesa**: ver secção 4.
- **A minha área**: mão e peças do jogador, em baixo ao centro.
- **Barra de ações**: em baixo ao centro; ação principal em `--game-accent`, as outras em vidro.
- **Registo**: em baixo à esquerda, discreto. No telemóvel dobra-se dentro de "A minha área" (REGISTO ▴).
- **Controlos da vista**: em baixo à direita (mover, aproximar, afastar, ver tudo).

No telemóvel (390 × 844): topo com voltar, nome do jogo, guia e língua; os dois primeiros jogadores e um "+2 ›"; fichas; tabuleiro; a minha área; barra de ações em grelha 2:1:1.

## 4. Componentes base

| Componente | Variantes | Tokens |
|---|---|---|
| Botão | primário, secundário, informação (contorno tracejado), desativado | `game-accent`, `game-on-accent`, `game-panel-2`, `game-line`, `game-accent-strong`, `game-disabled-*` |
| Carta / peça | com nome e quantidade (×3), vazia (tracejada) | `game-panel-2`, `game-line`, `game-muted` |
| Jogador | da vez, à espera, bot; componentes como botões | `game-color-n`, `game-accent`, `game-panel`, `game-line` |
| Disco / marcador | normal, alerta | `game-panel-2`, `game-color-n`, `game-danger` |
| Painel | registo | `game-panel`, `game-line`, `game-muted` |
| Modal | título, texto, 2 botões | `game-panel`, `game-line`, `game-accent` |
| Tutorial | alvo com contorno, balão com passo, título e Seguinte | `game-panel`, `game-accent` |
| Mensagem da mesa | vez, evento com subtítulo, aviso (cor `game-on-table-warn`), fim | `game-on-table`, `game-font-display` |
| Campo do nome | 48 px, centrado, contorno `game-accent` com halo | `game-panel`, `game-text`, `game-accent` |

**Mensagem da mesa**: aparece no meio do tabuleiro, cresce e desaparece (cerca de 2,5 s), não bloqueia cliques e aparece uma de cada vez (as seguintes esperam). O jogo manda o texto e a variante. Com `prefers-reduced-motion`, aparece e desaparece sem crescer.

Letras: `game-font-display` para títulos, pontos e mensagens; `game-font-body` para o resto. Contraste mínimo **4,5:1** entre texto e fundo; a consola avisa para os pares da lista `contrast` do `skin.json`.

## 5. Pendentes

Pontos por resolver antes de a UI genérica usar este desenho (medidos no canvas a 2026-09-26):

- **Contraste do vidro.** O vidro claro (`--game-glass`, creme a 30%) clareia o verde e baixa o contraste do texto creme. No centro da mesa: texto 3,1:1, texto secundário 2,4:1, "a pensar…" 2,5:1, registo (a 40%) 2,3:1. Proposta: vidro escuro, `rgba(20,32,26,.35)` com o mesmo desfoque (8,5 / 6,2 / 6,8:1).
- **Alvos de toque.** Os componentes do jogador têm 18–20 px, os botões de vidro 28–32 px e a barra de ações 32 px (40 no telemóvel). O mínimo é 44 px; nos componentes, a área de toque pode crescer sem mudar o desenho.
- **Campo do nome.** No Início e no Marca-produto (computador) o fundo passou a `--game-panel`, mas o texto continua `#fffaf1`: o que se escreve não se vê. O texto tem de ser `--game-text`. No telemóvel o campo ainda é de vidro.
- **Destaque sobre o realce.** `--game-accent` sobre `--game-panel-2` dá 4,26:1; o botão de informação já usa `--game-accent-strong` (7,6:1).
- **Figma.** O gradiente da mesa, os valores `rgba()`, as letras (pilha CSS) e o raio (`"14px"`) não se ligam diretamente a Variables do Figma. O canvas do Claude Design não tem este problema; se o template for para o Figma, o export (`tools/figma.js`) tem de mandar cor sólida, nome da família e número.
- **Plataforma.** A mesa em ecrã inteiro, a mensagem da mesa, os componentes como alvo e o relatório ainda não existem na UI genérica nem no contrato (ver ADR-014).

## 6. Da mesa desenhada ao jogo

- **Só cores, letras, imagens** → exporta as variáveis (DTCG) e usa **Consola › Aparência › Importar JSON**. Entram só os valores que mudaste; o modo exportado passa a ser o tema.
- **Design à medida** (arte, formas, layout) → um tema do pacote: `ui/themes/<nome>/theme.json` (valores dos tokens) + `theme.css`, com todas as regras a começar por `[data-game="<jogo>"]`.
- Imagens de fundo: WebP ou PNG até 300 KB para carregar pela consola; maiores vão para o pacote do jogo, em `ui/`.
