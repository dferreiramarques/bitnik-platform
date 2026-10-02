# Startup Panic — histórico de regras

## 3.3.0 — Tutorial guiado (2026-10-02)

Pedido do David: um tour/wizard para o jogo. Sem mudanças de regras (as mesas guardadas continuam a retomar).

- **Tutorial** (`ui/tutorial.js`, botão "Tutorial" no lobby e rota `#/tutorial/startup-panic`): corre o motor verdadeiro no browser e a mesma UI das mesas, com 19 passos em PT e EN: os jogadores e a ordem, as 12 rondas e os Gates, o CEO e os setores, as startups, o gráfico de velas (o jogador abre-o), comprar, fechar o Mercado, contratar, níveis e salários, terminar o turno, o bot a jogar, dividendos, o Gate, limites e maiorias, implosões e o arriscar do salário. Cada passo realça a zona da mesa de que fala e avança sozinho quando o jogador faz o que se pede; "Jogar a sério" abre uma mesa contra um bot.
- **Cenário `tutorial`** (`ctx.options.scenario`): o baralho começa por Jensen H., Patrick C. e Mark Z. (sem dado) e o jogador abre; o resto do jogo é o normal.
- A mesa deixa espaço ao guia (ao lado em ecrãs largos, por baixo em ecrãs estreitos).

## 3.2.0 — Histórico de preços com gráfico de velas (2026-10-02)

Pedido do David: um gráfico no estilo de câmbio (velas verdes e vermelhas) com os valores de cada startup ronda a ronda. Sem mudanças de regras; o estado passa a guardar o histórico (`hist`), por isso as mesas guardadas da 3.1 não têm gráfico (continuam jogáveis).

- **Vela por ronda e por startup:** abertura (preço no início da ronda, antes da penalização da Elizabeth H.), máximo, mínimo e fecho (o preço no fim da ronda; na ronda atual, o preço de agora). A vela acompanha o CEO, o PR e as implosões; uma startup que implode fecha a 0 (💀) e deixa de ter velas.
- **UI:** o nome de cada startup é um botão com tooltip ("Ver o histórico de preços") e um 📈; abre uma modal com o gráfico de velas: eixo das rondas 1 a 12 com os Gates sombreados e a ronda atual realçada, escala em M à direita, verde se subiu, vermelho se desceu, cinzento se ficou igual. Cada vela tem a descrição completa (ronda, abertura, máximo, mínimo, fecho) para leitores de ecrã e tooltip.
- Skin: dois tokens novos (`--sp-up` e `--sp-down`) para as cores das velas, editáveis na Aparência.

## 3.1.0 — Pagar os salários é opcional (2026-10-02)

Pedido do David: pagar deve ser uma escolha, para quem quiser arriscar. Mudança de regras (as mesas guardadas da 3.0 ficam expiradas):

- Nova jogada `SP_RISK_SALARY` por trabalhador: não pagas e lança-se o dado (6 fica sem receber, outro número sai), mesmo tendo cash.
- `SP_PAY_SALARY` passa a poder pagar um trabalhador (`worker`) ou, sem `worker`, todos os que o cash deixa.
- Ao terminar o turno, o que não decidiste cobra-se sozinho: paga-se se houver cash, senão lança-se o dado (como na 3.0). Quem já foi pago ou arriscado não se cobra outra vez.
- UI: cada trabalhador com salário mostra "Pagar XM" e "Arriscar 🎲" (e "✔ Salário pago"); o botão da barra passa a "Pagar todos". Novo texto no registo ("arriscou") e mensagem da mesa com o dado.

## 3.0.0 — Limite total de ações, níveis de trabalhador e salários com dado (2026-10-02)

Feedback do David a jogar a 2.0.0 (as mesas guardadas da 2.x ficam expiradas):

- **Limite total de ações:** 9 por jogador, em startups vivas (além das 4 por startup), para só dar para ter 2 ou 3 maiorias. Aplica-se às compras e às trocas; vender liberta espaço.
- **Pool de trabalhadores:** uma cópia de cada tipo por jogador (8, 12 ou 16), em vez de 3 de cada. Com 12 fixos os primeiros a jogar esgotavam os tipos e o último ficava só com PR.
- **Níveis de trabalhador pela ordem de contratação:** 1.º Estagiário (×1, grátis), 2.º Júnior (×2, 1M), 3.º Mid (×3, 2M) e 4.º em diante Sénior (×4, 3M); salário por ronda igual ao custo. Deixa de se escolher Estagiário ou Sénior, e **deixa de haver limite de 4 trabalhadores** (o custo e a pool limitam). A indemnização de mover passa a ser o salário (mínimo 1M).
- **Salários não pagos:** em vez de o trabalhador sair sempre, lança-se um dado: com **6 fica** (sem receber), com outro número **sai**. A mesa avisa o que aconteceu (mensagem e registo).
- **UI:** timeline das 12 rondas com os Gates em destaque (🔔 e o piso ×5, ×10, ×20; o multiplicador real quando abre), ações n/9 em cada jogador, nível de cada trabalhador, salários por ronda, e ao contratar mostra o nível, o custo e o salário do próximo.
- O bot só contrata se o cash chegar para o custo, os salários de todos e uma folga, e não passa dos 4 trabalhadores.

## 2.0.0 — Trabalhadores com papel e implosão com critério (2026-10-02)

Feedback do David depois de jogar: "as ações parecem não ter impacto", "não sei o que faço com os trabalhadores" e "qual o critério da implosão?". Mudança de regras (as mesas guardadas da 1.x ficam expiradas):

- **Advogado:** protege a startup onde está (de qualquer jogador) de implodir; mantém o dividendo de 1M por ação.
- **PR:** sobe 1M ao preço da startup por cada PR lá; mantém o dividendo de 1M por ação.
- **CFO:** deixa de pagar por ação; passa a renda fixa de 2M por ronda (4M no Sénior), mesmo sem ações. Dá cash desde a ronda 1.
- **Engenheiro:** igual (2M por ação).
- **Implosão:** atinge a startup viva **mais cara sem Advogado** (empate: sorteio), em vez de uma ao acaso. Se todas tiverem Advogado, nada implode.
- **UI (sem regras):** cada trabalhador mostra o que faz e quanto rende por ronda; cada startup mostra o rendimento da minha equipa, um aviso se tenho ações sem equipa, a proteção do Advogado, o bónus de PR e a variação de preço do CEO (▲▼); a minha área mostra o valor total e os dividendos previstos; ao contratar vê-se a descrição do tipo.
- O bot contrata também um Advogado (onde tem mais valor) e um CFO.

## 1.0.0 — Aprovado (2026-10-02)

Aprovado pelo David no Studio: deixa de ser protótipo (sem selo nem modo protótipo). Sem mudanças de regras nem de UI em relação à 0.2.1; as mesas guardadas da 0.x ficam expiradas.

## 0.2.1 — UI própria no template vanilla (2026-10-02)

Sem mudanças de regras. UI própria (`ui/`): jogadores pela ordem da ronda (o cash dos outros aparece como cadeado), CEO do dia com o dado, setores, as 10 startups com as ações de cada um e a maioria, a minha equipa, janelas para contratar, mover, propor e responder a trocas, e a modal "Como se joga". Skin `ui/skin.json` com a mesa azul-noite e uma cor por setor. Registado no Studio como protótipo, a aguardar aprovação.

## 0.2.0 — Sem comprar e vender no Gate no mesmo turno (2026-10-02)

Encontrado ao simular com o bot: com o Gate aberto, comprar 1 ação (maioria imediata) e vendê-la logo a seguir dava lucro de ×5/×10/×20, repetível sem limite (o `server.js` original tem o mesmo buraco). Passa a ser recusada a venda no Gate de uma startup em que o jogador comprou nesse turno (`err.COMPRADA_NO_TURNO`). Comprar uma ronda antes e vender no Gate continua a ser a jogada normal.

## 0.1.0 — Migração para a plataforma (2026-10-02)

Primeira versão no pacote: regras do `server.js` do repositório `startup-panic`, com `REGRAS.md` escrito a partir do `RULES.md`. Protótipo: só no Studio, a aguardar aprovação.

Regras mantidas como estavam (já equilibradas por simulação): máximo de 4 ações por startup e de 4 trabalhadores por jogador, 1 trabalhador de cada tipo por startup, venda no Gate com maioria real, venda livre no mercado, piso do Gate ×5/×10/×20 com arquétipo ×1,5/×0,7 e bónus da Whitney W. (acumulado, como no código), ordem de jogo dinâmica.

Diferenças em relação ao `server.js`:

- **Aleatoriedade só pelo `ctx.rng`:** baralho de CEOs, dado, implosões, nomes dos trabalhadores e jogador inicial.
- **Gate:** já não se vende uma startup implodida, e só se vende na fase de Mercado (antes também funcionava na Manutenção).
- **Salários:** `SP_PAY_SALARY` só se paga uma vez por turno e `SP_END_TURN` cobra os que faltarem. Antes o pagamento era opcional e dava para ficar com Séniores sem os pagar.
- **Mover trabalhador:** já não se move para a mesma startup nem para uma onde já há um do mesmo tipo (antes contornava a regra de 1 por tipo).
- **Troca no Gate (`SP_TRADE_*`):** passa a ser uma proposta que o outro jogador tem de aceitar, e respeita o máximo de 4 ações. Antes era unilateral e não tinha UI.
- **Empates:** partilham a vitória.
