# Startup Panic — regras

Cada jogador é um **Business Angel** a investir em 10 startups, espalhadas por 5 setores, enquanto **CEOs caóticos** empurram o valor dos setores para cima e para baixo e, por vezes, fazem startups **implodir**. Ganha quem tiver mais valor (cash + ações) no fim da ronda 12.

2 a 4 jogadores. Informação escondida: só o **cash dos outros jogadores**. Ações, trabalhadores e a pool são públicos.

## Componentes

**Setores (5):** IA, Fintech, Segurança, Biotech, Energia.

**Startups (10, duas por setor):**

| Startup | Setor | Preço base |
|---|---|---|
| DeePanic | IA | 3M |
| HalluciNet | IA | 2M |
| CashBurn | Fintech | 4M |
| TokenStonks | Fintech | 3M |
| HackShield | Segurança | 3M |
| ZeroTrustUs | Segurança | 2M |
| CRISPRash | Biotech | 4M |
| PharmaRush | Biotech | 3M |
| FusionFail | Energia | 2M |
| SolarScam | Energia | 3M |

**Preço de mercado** = preço base + valor acumulado do setor, no mínimo 1M. As startups do mesmo setor sobem e descem sempre juntas.

**Trabalhadores:** pool partilhada de 12 (3 de cada tipo).

| Tipo | Dividendo base por ação e por ronda |
|---|---|
| Engenheiro | 2M |
| Advogado | 1M |
| PR | 1M |
| CFO | 1M |

- **Estagiário:** grátis; gera o dividendo base.
- **Sénior:** custa 2M ao contratar e 1M por ronda de salário; gera o **dobro**.

## Preparação

Cada jogador começa com **10M** e sem ações. Baralham-se os 12 CEOs (um por ronda). O jogador que abre a ronda 1 é sorteado e segue-se o sentido normal.

## CEOs

Cada CEO tem um **setor de afinidade**, que recebe sempre **+1M** antes do efeito (haja dado ou não), e um efeito. Os que têm dado lançam-no automaticamente.

| CEO | Arquétipo | Afinidade | Dado | Efeito |
|---|---|---|---|---|
| Elon V. | Caótico Visionário | Energia | sim | IA +⌊dado/2⌋M; com 5 ou 6, implode uma startup |
| Mark Z. | Metódico Controlador | Fintech | não | Fintech +2M, IA −1M |
| Sam A. | Hype Master | IA | sim | IA +dado M, Biotech −1M |
| Jensen H. | Técnico Preciso | IA | não | IA +3M, Energia −1M |
| Reed H. | Pivot Constante | Fintech | sim | O setor n.º (dado mod 5) sobe 2M e o n.º ((dado+2) mod 5) desce 2M, pela ordem IA, Fintech, Segurança, Biotech, Energia |
| Travis K. | Disruptivo | Segurança | sim | Implode uma startup (salvo "seguro"); Segurança +(dado−2)M |
| Elizabeth H. | Fraude Elegante | Biotech | não | Biotech +4M agora e **−4M no início da ronda seguinte** |
| Brian C. | Partilha de Risco | Energia | não | Todos os setores +1M; nenhuma startup implode nessa ronda ("seguro") |
| Adam N. | Wellness Caótico | Biotech | sim | Biotech +(dado−3)M; salários +1M nessa ronda |
| Patrick C. | Crescimento Metódico | Fintech | não | Fintech +2M, Segurança +1M |
| Sam B. | Colapso Espectacular | Fintech | sim | Dado ≥ 4: implode uma startup; abaixo: Fintech +4M |
| Whitney W. | Exit Queen | Segurança | não | O multiplicador dos Gates seguintes sobe 1 nível (acumula) |

Uma startup que **implode** deixa de valer: não se compra, não paga dividendos, não conta na pontuação e não se vende. A que implode é escolhida ao acaso entre as vivas.

## A ronda

Há **12 rondas**, uma por CEO. Cada ronda:

1. Aplica-se a penalização diferida da Elizabeth H., se houver.
2. Revela-se o CEO: afinidade +1M, dado (se tiver) e efeito.
3. Nas rondas **4, 8 e 12** abre o **Gate de Venda**.
4. Define-se a **ordem de jogo** (ver abaixo).
5. Cada jogador joga o seu turno: **Mercado** e depois **Manutenção**.
6. Quando o último termina, pagam-se os **dividendos** e entra o CEO seguinte. Depois da ronda 12, o jogo acaba.

### Ordem de jogo

- **Ronda 1:** sorteada, no sentido normal.
- **Rondas seguintes:** depois de revelado o CEO e atualizados os preços, joga primeiro quem tem ações na **startup mais cara** (conta-se, para cada jogador, a startup mais cara em que tem ações), depois quem tem na segunda mais cara, e assim por diante. Quem não tem ações joga no fim. **Os empates mantêm a ordem da ronda anterior.**

### Mercado

- **Comprar** (`SP_BUY`): `qty` ações de uma startup viva ao preço atual. **Máximo 4 ações da mesma startup por jogador.**
- **Vender no mercado** (`SP_SELL_MARKET`): a qualquer momento da fase de Mercado, sem Gate nem maioria, ao preço atual e **sem multiplicador**. É a saída de liquidez de quem não tem maioria.
- **Vender no Gate** (`SP_SELL_STARTUP`): só com o Gate aberto e com **maioria real** (mais de 50% das ações emitidas da startup; empatar ou ser o maior não chega). Recebe `preço × ações × multiplicador` e perde todas as ações dessa startup. Não se vende uma startup implodida.
- **Trocar no Gate** (`SP_TRADE_PROPOSE`): com o Gate aberto, o jogador propõe a outro trocar **todas** as suas ações de uma startup por **todas** as ações que ele tem noutra. A troca só se faz se o outro **aceitar** (`SP_TRADE_ACCEPT`); se recusar (`SP_TRADE_REJECT`), nada muda e o proponente continua o turno. Ambos têm de ter ações das startups trocadas e a troca não pode dar a ninguém mais de 4 ações da mesma startup.
- **Fechar o Mercado** (`SP_END_MARKET`): passa à Manutenção.

### Gate de Venda

Abre nas rondas **4, 8 e 12**, com um **piso garantido** de **×5, ×10 e ×20**. O arquétipo do CEO dessa ronda multiplica o piso:

- **Alto** (Sam A., Elon V., Whitney W., Sam B.): ×1,5.
- **Baixo** (Mark Z., Jensen H., Patrick C., Brian C.): ×0,7.
- **Neutro:** ×1.

O resultado arredonda-se e soma-se o bónus acumulado da Whitney W. O Gate fica aberto durante a ronda toda. O final apoteótico (a venda da ronda 12 domina o jogo) é intencional.

### Manutenção

- **Contratar** (`SP_HIRE`): tira um trabalhador da pool e põe-no numa startup (não é preciso ter ações nela, mas só se recebem dividendos dela com ações). Estagiário grátis ou Sénior por 2M. **Máximo 1 de cada tipo por startup e 4 trabalhadores por jogador.**
- **Despedir** (`SP_FIRE`): o trabalhador volta à pool.
- **Mover** (`SP_MOVE_WORKER`): muda um trabalhador de startup, com indemnização de 1M (Estagiário) ou 2M (Sénior); não para a mesma startup nem onde já tens um desse tipo.
- **Pagar salários** (`SP_PAY_SALARY`): 1M (mais a sobretaxa do Adam N.) por cada Sénior. Quem não tiver cash para um Sénior perde-o: volta à pool. Os salários por pagar cobram-se sozinhos ao terminar o turno.
- **Terminar o turno** (`SP_END_TURN`).

### Dividendos

No fim de cada ronda, para cada startup viva em que o jogador tem ações **e** pelo menos um trabalhador seu:

```
dividendo por ação = Σ (dividendo base do tipo × 2 se for Sénior)
ganho = ações × dividendo por ação
```

## Fim do jogo

Pontuação = `cash + Σ (ações × preço atual)` das startups não implodidas (as ações valem o preço de mercado, sem multiplicador do Gate). Ganha a pontuação mais alta; em caso de empate, os lugares empatados partilham a vitória.

## Estratégia (resumo)

1. Os dividendos compõem o cash: uma ação sem trabalhador não paga nada, e o Engenheiro Sénior (4M por ação) costuma ser o melhor investimento.
2. A maioria real é o que abre o Gate. Concentra onde queres maioria; diversifica onde só queres exposição.
3. O CEO é revelado antes de jogares: reage a setores que acabaram de cair.
4. Elon V., Travis K. e Sam B. podem fazer implodir uma startup: não ponhas tudo numa só.
5. Mantém cash para os salários dos Séniores.
6. Só o Gate realiza o multiplicador; ações guardadas até ao fim valem o preço normal.
