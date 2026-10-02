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

**Histórico:** a UI guarda e mostra o preço de cada startup ronda a ronda num gráfico de velas (abertura, máximo, mínimo e fecho), aberto pelo nome da startup.

**Preço de mercado** = preço base + valor acumulado do setor + 1M por cada PR (de qualquer jogador) na startup, no mínimo 1M. As startups do mesmo setor sobem e descem juntas (o PR é a única diferença).

**Trabalhadores:** pool partilhada com **uma cópia de cada tipo por jogador** (2 jogadores: 8; 3: 12; 4: 16), para ninguém ficar sem tipos.

| Tipo | O que rende (antes do nível) | Efeito próprio |
|---|---|---|
| Engenheiro | 2M por ação e por ronda | — |
| Advogado | 1M por ação e por ronda | **Protege** a startup de implodir |
| PR | 1M por ação e por ronda | **+1M ao preço** da startup |
| CFO | **Renda fixa de 2M por ronda**, mesmo sem ações | — |

**Nível** (depende da ordem em que contratas; fica fixo ao contratar):

| Contratado | Nível | Rende | Custa a contratar | Salário por ronda |
|---|---|---|---|---|
| 1.º | Estagiário | ×1 | 0M | 0M |
| 2.º | Júnior | ×2 | 1M | 1M |
| 3.º | Mid | ×3 | 2M | 2M |
| 4.º em diante | Sénior | ×4 | 3M | 3M |

Despedir devolve o trabalhador à pool mas não promove nem despromove os outros: o seguinte que contratares tem o nível que a tua equipa atual dá.

Quanto mais nível, mais rende (também a renda fixa do CFO), mas mais caro é manter a equipa: uma equipa de 4 paga 6M por ronda.

## Preparação

Cada jogador começa com **10M** e sem ações. Baralham-se os 12 CEOs (um por ronda). O jogador que abre a ronda 1 é sorteado e segue-se o sentido normal.

## CEOs

Cada CEO tem um **setor de afinidade**, que recebe sempre **+1M** antes do efeito (haja dado ou não), e um efeito. Os que têm dado lançam-no automaticamente.

| CEO | Arquétipo | Afinidade | Dado | Efeito |
|---|---|---|---|---|
| Elon V. | Caótico Visionário | Energia | sim | IA +⌊dado/2⌋M; com 5 ou 6, implode uma startup (a mais cara sem Advogado) |
| Mark Z. | Metódico Controlador | Fintech | não | Fintech +2M, IA −1M |
| Sam A. | Hype Master | IA | sim | IA +dado M, Biotech −1M |
| Jensen H. | Técnico Preciso | IA | não | IA +3M, Energia −1M |
| Reed H. | Pivot Constante | Fintech | sim | O setor n.º (dado mod 5) sobe 2M e o n.º ((dado+2) mod 5) desce 2M, pela ordem IA, Fintech, Segurança, Biotech, Energia |
| Travis K. | Disruptivo | Segurança | sim | Implode uma startup (a mais cara sem Advogado; salvo "seguro"); Segurança +(dado−2)M |
| Elizabeth H. | Fraude Elegante | Biotech | não | Biotech +4M agora e **−4M no início da ronda seguinte** |
| Brian C. | Partilha de Risco | Energia | não | Todos os setores +1M; nenhuma startup implode nessa ronda ("seguro") |
| Adam N. | Wellness Caótico | Biotech | sim | Biotech +(dado−3)M; salários +1M nessa ronda |
| Patrick C. | Crescimento Metódico | Fintech | não | Fintech +2M, Segurança +1M |
| Sam B. | Colapso Espectacular | Fintech | sim | Dado ≥ 4: implode uma startup (a mais cara sem Advogado); abaixo: Fintech +4M |
| Whitney W. | Exit Queen | Segurança | não | O multiplicador dos Gates seguintes sobe 1 nível (acumula) |

Uma startup que **implode** deixa de valer: não se compra, não paga dividendos, não conta na pontuação e não se vende. Implode **a startup viva mais cara que não tenha um Advogado** (de qualquer jogador); se houver empate no preço, sorteia-se entre as mais caras. Se todas as startups vivas tiverem Advogado, nada implode.

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

- **Comprar** (`SP_BUY`): `qty` ações de uma startup viva ao preço atual. **Máximo 4 ações da mesma startup por jogador e 9 no total** (em startups vivas): só dá para ter 2 ou 3 maiorias. Vender liberta espaço.
- **Vender no mercado** (`SP_SELL_MARKET`): a qualquer momento da fase de Mercado, sem Gate nem maioria, ao preço atual e **sem multiplicador**. É a saída de liquidez de quem não tem maioria.
- **Vender no Gate** (`SP_SELL_STARTUP`): só com o Gate aberto e com **maioria real** (mais de 50% das ações emitidas da startup; empatar ou ser o maior não chega). Recebe `preço × ações × multiplicador` e perde todas as ações dessa startup. Não se vende uma startup implodida, nem uma startup em que se comprou **nesse mesmo turno** (senão bastava comprar uma ação e vendê-la logo ao multiplicador, sem limite).
- **Trocar no Gate** (`SP_TRADE_PROPOSE`): com o Gate aberto, o jogador propõe a outro trocar **todas** as suas ações de uma startup por **todas** as ações que ele tem noutra. A troca só se faz se o outro **aceitar** (`SP_TRADE_ACCEPT`); se recusar (`SP_TRADE_REJECT`), nada muda e o proponente continua o turno. Ambos têm de ter ações das startups trocadas e a troca não pode dar a ninguém mais de 4 ações da mesma startup nem mais de 9 no total.
- **Fechar o Mercado** (`SP_END_MARKET`): passa à Manutenção.

### Gate de Venda

Abre nas rondas **4, 8 e 12**, com um **piso garantido** de **×5, ×10 e ×20**. O arquétipo do CEO dessa ronda multiplica o piso:

- **Alto** (Sam A., Elon V., Whitney W., Sam B.): ×1,5.
- **Baixo** (Mark Z., Jensen H., Patrick C., Brian C.): ×0,7.
- **Neutro:** ×1.

O resultado arredonda-se e soma-se o bónus acumulado da Whitney W. O Gate fica aberto durante a ronda toda. O final apoteótico (a venda da ronda 12 domina o jogo) é intencional.

### Manutenção

- **Contratar** (`SP_HIRE`): tira um trabalhador da pool e põe-no numa startup (não é preciso ter ações nela, mas só se recebem dividendos dela com ações). O nível (e o custo) sai da ordem de contratação. **Máximo 1 de cada tipo por startup; não há limite fixo de trabalhadores**, só a pool e o custo.
- **Despedir** (`SP_FIRE`): o trabalhador volta à pool.
- **Mover** (`SP_MOVE_WORKER`): muda um trabalhador de startup, com indemnização igual ao salário (mínimo 1M); não para a mesma startup nem onde já tens um desse tipo.
- **Salários** (de cada trabalhador com salário, mais 1M de sobretaxa com o Adam N.): **pagar é opcional**. Por trabalhador podes **pagar** (`SP_PAY_SALARY`, ou sem `worker` para pagar todos os que o cash deixar) ou **arriscar** (`SP_RISK_SALARY`): não pagas e **lança-se um dado**; com **6 o trabalhador fica** (sem receber), com **qualquer outro número vai-se embora** e volta à pool. Arriscar não custa cash e podes fazê-lo mesmo tendo dinheiro. O que não decidires cobra-se ao terminar o turno: paga-se se houver cash e, se não houver, **lança-se o dado**. Quem se paga (ou arrisca) neste turno não se cobra outra vez. A mesa avisa sempre o que aconteceu.
- **Terminar o turno** (`SP_END_TURN`).

### Dividendos

No fim de cada ronda, para cada startup viva onde o jogador tem trabalhadores:

```
por ação = Σ (dividendo do tipo × 2 se for Sénior), para Engenheiro, Advogado e PR (nível: ×1 a ×4)
ganho = ações × por ação + Σ (2M × nível), para os CFO
```

Sem ações, só os CFO rendem. Sem trabalhadores, nada. A UI mostra o que cada trabalhador rende e o total previsto.

## Fim do jogo

Pontuação = `cash + Σ (ações × preço atual)` das startups não implodidas (as ações valem o preço de mercado, sem multiplicador do Gate). Ganha a pontuação mais alta; em caso de empate, os lugares empatados partilham a vitória.

## Estratégia (resumo)

1. Os dividendos compõem o cash: uma ação sem trabalhador não paga nada, e o Engenheiro Sénior (4M por ação) costuma ser o melhor investimento. O CFO dá cash logo desde a ronda 1, sem ações. Cada trabalhador a mais custa mais: pensa antes de passares do 3.º.
2. A maioria real é o que abre o Gate. Com 9 ações no total, escolhe 2 ou 3 startups onde queres maioria.
3. O CEO é revelado antes de jogares: reage a setores que acabaram de cair.
4. Elon V., Travis K. e Sam B. fazem implodir a startup mais cara sem Advogado: ser dono da líder tem risco. Um Advogado protege a startup (e as ações de todos os que a têm); um PR sobe-lhe o preço.
5. Mantém cash para os salários: sem pagamento há um dado, e só com um 6 o trabalhador fica. Arriscar de propósito poupa cash, mas 5 em 6 perdes o trabalhador.
6. Só o Gate realiza o multiplicador; ações guardadas até ao fim valem o preço normal.
