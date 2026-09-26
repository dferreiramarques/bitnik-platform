# Nine Oils — Regras (PT)

Texto do README do jogo online antigo (v1.4), edição portuguesa. Desde a 1.1.0 a plataforma usa 2 Rapazes, como diz o texto (o jogo online antigo tinha 3; ver CHANGELOG.md).


## Contexto

Em 1861, o comércio do óleo de cobra estava no seu auge — e tu estás prestes a embarcar numa aventura no coração deste negócio intrigante. Planeias estabelecer uma banca no mercado para promover e vender a tua própria marca de óleo de cobra. À medida que o teu negócio prospera, terás de expandir a banca, reabastecer o stock e persuadir figuras influentes para ganhar vantagem sobre os teus rivais.

**Objectivo:** sê o primeiro vendedor a colocar todas as seis garrafas na tua banca.

## Componentes

- 2 cartas de Banca (6 casas cada, 2 bloqueadas por cubos vermelhos no início)
- 9 dados
- 8 cartas de Personagem (2× Sedutora, 2× Rapaz, 4× Valentão)
- Fichas de garrafas de Óleo de Cobra

## Preparação

1. Cada jogador recebe uma carta de Banca. Coloca 2 cubos vermelhos nas casas 1 e 2 — estas casas estão bloqueadas até serem abertas por um Quad ou Oito de um Tipo.
2. Baralha as 8 cartas de Personagem e coloca-as viradas para baixo no centro como o baralho.
3. Cada jogador compra 1 carta do baralho.
4. Decide aleatoriamente quem começa.

## Condição de Vitória

O primeiro jogador a colocar garrafas em todas as **6 casas** da sua banca vence. Uma casa tem de estar desbloqueada (sem cubo vermelho) antes de poder receber uma garrafa.

---

## Estrutura do Turno

Cada turno tem até 4 passos:

1. **Jogar Cartas** *(opcional)* — joga cartas de Personagem da tua mão antes de lançar os dados.
2. **Lançar** — lança todos os 9 dados.
3. **Resolver Combinações** — aplica todas as combinações elegíveis do teu lançamento.
4. **Descartar** — se tiveres mais de 3 cartas, descarta até ficares com 3.

---

## Combinações de Dados

> **Regra fundamental:** cada valor de face produz **apenas uma combinação** por lançamento. Se a mesma face se qualificar para múltiplas combinações, tens de escolher uma. Os dados restantes dessa face são descartados — sem cascata.

### Combinações Normais

| Dados | Combinação | Efeito |
|---|---|---|
| Quaisquer 2 iguais | **DOUBLE** | Compra 1 carta de Personagem do baralho |
| 3 de um valor + 2 de outro | **TRIPLE + DOUBLE** | Coloca 1 garrafa na tua banca |
| 4 do mesmo valor | **QUAD** | Remove 1 cubo vermelho, desbloqueando uma casa |
| 5 do mesmo valor | **PENTA** | O adversário descarta toda a mão |
| 6 do mesmo valor | **SEIS** | Compra 3 cartas de Personagem do baralho |

> **Regra do Triple + Double:** o par tem de vir de um valor de face *diferente* do trio. Um par do mesmo valor que o trio não conta.

> **Conflito de combinações:** se lançares, por exemplo, quatro 3s e três 5s — tens um conflito entre QUAD (quatro 3s) e TRIPLE+DOUBLE (três 5s + dois dos 3s). Tens de escolher uma.

### Combinações Especiais

| Dados | Combinação | Efeito |
|---|---|---|
| 7 do mesmo valor | **✦ JOKER** | Escolhe qualquer combinação anterior (de Double a Seis) |
| 8 do mesmo valor | **✦ OITO DE UM TIPO** | Remove 2 cubos vermelhos instantaneamente |
| Todos 9 iguais | **✦ NOVE DE UM TIPO** | Vitória instantânea |

> **Nota sobre o Joker:** ao usares o Joker para seleccionar Triple+Double, o par *não* precisa de ser de um valor de face diferente — todos os 7 dados contam.

### Probabilidades das Combinações (9 dados, 6 faces)

| Combinação | Frequência aproximada |
|---|---|
| Double | Em todos os lançamentos |
| Triple+Double | ~82% dos lançamentos |
| Quad | ~28% dos lançamentos |
| Penta | ~5% dos lançamentos (1 em 19) |
| Seis de um Tipo | 1 em ~160 lançamentos |
| Joker (7) | 1 em ~1.900 lançamentos |
| Oito de um Tipo | 1 em ~40.000 lançamentos |
| Nove de um Tipo | 1 em ~1.700.000 lançamentos |

---

## Cartas de Personagem

As cartas jogam-se no **início do teu turno**, antes de lançar os dados. Podes jogar qualquer número de cartas. As cartas são descartadas após uso, salvo indicação contrária.

### 💃 A Sedutora *(×2)*

Joga antes de lançar. Quando lançares um Triple+Double, ganha **1 garrafa adicional** (2 no total). Jogar ambas as cartas de Sedutora concede 2 garrafas extra (3 no total).

### 🤏 O Rapaz *(×2)*

Joga no teu turno para **roubar 1 garrafa** da banca do adversário. Cada carta de Rapaz é uma tentativa de roubo.

| Cenário | Resultado |
|---|---|
| 1 Rapaz, sem Valentões | Roubar 1 garrafa |
| 1 Rapaz vs. 1 Valentão | Roubo totalmente bloqueado |
| 2 Rapazes vs. 1 Valentão | 1 roubada, 1 bloqueada |
| 2 Rapazes vs. 0 Valentões | 2 roubadas |

O defensor escolhe quantos Valentões jogar (até ao número de Rapazes em ataque). Jogar 2 Rapazes em simultâneo (antes da resposta do defensor) é inbloqueável por um único Valentão.

### 👊 O Valentão *(×4)*

**Uso defensivo:** joga no turno do *adversário* para cancelar um ataque de Rapaz. Ambas as cartas (Rapaz + Valentão) são descartadas.

**Uso ofensivo:** joga **2 Valentões** no *teu próprio* turno — descarta às cegas 1 carta da mão do adversário.

---

## Limite de Mão

Nunca podes ter mais de **3 cartas de Personagem** no final do teu turno. Se ultrapassares este limite, descarta até ficares com 3. Não existe mínimo de cartas na mão.

---

## Referência Rápida

```
2 iguais             →  Double — compra uma carta
3+2 (faces dif.)    →  Triple+Double — coloca uma garrafa
4 iguais             →  Quad — desbloqueia uma casa
5 iguais             →  Penta — adversário descarta a mão
6 iguais             →  Seis — compra 3 cartas
7 iguais             →  Joker — escolhe qualquer combinação anterior
8 iguais             →  Oito de um Tipo — remove 2 cubos
9 iguais             →  Vitória Instantânea
```

---

*Nine Oils — Game design & development · David Marques · 2025*
