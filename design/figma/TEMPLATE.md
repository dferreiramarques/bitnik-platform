# Template vanilla no Figma

Guião para montar o ficheiro base de desenho de jogos da Bitnik. As Variables do Figma usam **os mesmos nomes** dos tokens da plataforma (`skin.json`), por isso o que se desenha no Figma entra na consola sem tradução (ADR-008).

## 1. Importar as variáveis

```bash
npm run figma          # gera design/figma/*.tokens.json
```

| Ficheiro | Coleção no Figma | Modo |
|---|---|---|
| `brand.tokens.json` | Brand | Bitnik |
| `vanilla.tokens.json` | Vanilla | Default |
| `catania.default.tokens.json` | Catania | Default |
| `catania.dia.tokens.json` | Catania | Dia |

Formato **W3C Design Tokens (DTCG)**. No Figma: painel **Variables** › importar (ou o plugin *Tokens Studio*, se a importação nativa não estiver disponível no teu plano). Cada ficheiro de jogo é um **modo** da mesma coleção: um tema novo é um modo novo.

Não mudes o `$extensions.bitnik.token` de cada variável: é o que liga a variável ao token CSS na volta. Podes renomear e reagrupar à vontade.

## 2. Páginas

1. **Capa**: nome do jogo, versão do pacote, tema.
2. **Tokens**: amostras de cada grupo (Mesa, Base, Recursos/Peças, Jogadores, Letra, Forma), ligadas às variáveis.
3. **Componentes**: ver 4.
4. **Mesa: desktop** (1280 × 800) e **Mesa: telemóvel** (390 × 844), ver 3.
5. **Temas**: a mesma mesa em cada modo, lado a lado.

## 3. Frames da mesa

A plataforma desenha a **moldura** (marca do cliente); o jogo desenha só a **área da mesa**.

```
┌──────────────────────────── Moldura (Brand) ─────────────────────────────┐
│ Barra: marca · estado · nome · língua                                     │
│ Faixa de avisos (opcional)                                                │
│ Título do jogo · mesa · [Modo protótipo] [Sair]                           │
│ ┌──────────────────────── Área da mesa (--table-bg) ───────────────────┐ │
│ │ Topo: ronda · de quem é a vez                                         │ │
│ │ Jogadores (--game-color-1..4)            │ Ações                      │ │
│ │ Tabuleiro                                │ Painéis do jogo            │ │
│ │ A minha área (mão, peças)                │ Registo                    │ │
│ └───────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Área da mesa**: preenchimento = `table-bg`. É o único token obrigatório de toda a skin. Pode ser cor, gradiente ou imagem.
- Painéis por cima da mesa: `game-panel`, contorno `game-line`, raio `game-radius`.
- No telemóvel (≤ 760 px de largura) tudo passa a uma coluna: tabuleiro, a minha área, ações, painéis, registo.
- Alvos de toque com pelo menos 44 px.

## 4. Componentes base (vanilla)

| Componente | Variantes | Tokens |
|---|---|---|
| Botão | primário, secundário, informação, desativado | `game-accent`, `game-on-accent`, `game-panel-2`, `game-line` |
| Painel | normal, destacado (vez do jogador) | `game-panel`, `game-line`, `game-accent` |
| Jogador | ativo, à espera, bot | `game-color-n`, `game-text`, `game-muted` |
| Carta / peça | com quantidade, vazia | `game-panel-2`, `game-line` |
| Disco / marcador | normal, alerta | `game-panel-2`, `game-accent`, `game-danger` |
| Modal | título, texto, 2 botões | `game-panel`, `game-accent` |
| Guia do tutorial | passo, título, texto, seguinte | `game-panel`, `game-accent` |
| Destaque do tutorial | contorno a pulsar | `game-accent` |

Letras: `game-font-display` (títulos) e `game-font-body` (texto). Contraste mínimo **4.5:1** entre texto e fundo; a consola avisa quando não chega.

## 5. Da mesa desenhada ao jogo

- **Só cores, letras, imagens** → exporta as variáveis (DTCG) e usa **Consola › Aparência › Importar JSON**. Entram só os valores que mudaste; o modo exportado passa a ser o tema.
- **Design à medida** (arte, formas, layout) → um tema do pacote: `ui/themes/<nome>/theme.json` (valores dos tokens) + `theme.css`, com todas as regras a começar por `[data-game="<jogo>"]`.
- Imagens de fundo: exporta em WebP ou PNG até 300 KB para carregar pela consola; maiores vão para o pacote do jogo, em `ui/`.
