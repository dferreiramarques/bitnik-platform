# Catania — histórico de regras

Vitórias por lugar em simulação com bots (10 000 partidas por número de jogadores). Com partilha de vitórias nos empates.

## 5.0.2 — Registo mais discreto; começa fechado; some no telemóvel

Sem mudanças de jogo: o texto do registo passa a branco, fino e pequeno,
sem sombra nem cor de destaque nos nomes (era dourado) — um log discreto.
Deixa de ter scroll (o conteúdo mais antigo corta, não se vê); cresce até
50% da altura do ecrã. Começa sempre fechado. No telemóvel deixa de haver
o botão "Registo" dentro de "A minha área" que o abria num pop-up: o
registo não aparece de todo, como nos outros jogos.

## 5.0.1 — Controlos da vista sem fundo; registo cresce até meio ecrã

Sem mudanças de jogo: os botões de zoom/arrastar tinham um painel de
vidro por engano — o template vanilla já dizia que deviam flutuar sem
fundo, como o registo (`design/figma/TEMPLATE.md`). Corrigido: só o ícone,
com sombra. O registo passa a crescer com o conteúdo até 50% da altura do
ecrã e só a partir daí desliza, em vez de cortar nas últimas 4 entradas.

## 5.0.0 — Pilhas como pilhas

**A pilha de cada recurso deixa de estar ordenada.** Quem recolhe 2 cartas tira o disco mais alto da torre e põe-no **em cima** da pilha desse recurso: esse disco passa a ser o valor, mesmo que seja mais alto do que o anterior. Ao valorizar, sai o disco de cima (o último que lá foi posto), volta à torre e o valor volta ao do disco de baixo. A torre continua ordenada.

Até à 4.0.1, a pilha era reordenada a cada disco (o mais baixo em cima): recolher 2 nunca subia o valor e valorizar tirava sempre o disco mais baixo. Não era a regra do jogo, e o painel das pilhas mostrava efeitos diferentes para o mesmo disco ("passa a 9" num recurso, "mantém 8" noutro).

| Jogadores | 4.0.1 | 5.0.0 | 5.0.0 sem a abertura | Justo |
|---|---|---|---|---|
| 2 | 50,5 / 49,5 | 50,3 / 49,7 | 52,3 / 47,7 | 50 |
| 3 | 34,7 / 32,3 / 33,0 | 33,4 / 33,6 / 33,0 | 34,6 / 32,4 / 33,0 | 33,3 |
| 4 | 25,9 / 25,3 / 23,4 / 25,5 | 24,7 / 24,9 / 24,0 / 26,4 | 25,7 / 24,5 / 24,1 / 25,7 | 25 |

A regra de abertura da 4.0.0 continua a fazer falta (sem ela, o 1.º lugar volta a ganhar 52% a 2 jogadores). A 3 jogadores, a vantagem que sobrava ao 1.º lugar desaparece.

As partidas guardadas da 4.x ficam marcadas como versão antiga (ADR-004).

A UI diz agora, em todas as pilhas, o mesmo efeito de recolher 2 ("passa a 9"), porque o disco que entra é sempre o do topo da torre.

## 4.0.1 — Próximo disco à vista

Sem mudança de regras. A UI mostra, em cada pilha, com que valor o recurso fica se alguém recolher 2 cartas (o disco do topo da torre, se for mais baixo), e o botão "Recolher 2" diz qual é o próximo disco. Um recurso em que ninguém mexeu pode cair de uma vez (ex.: de 11 para 3) quando a torre já só tem discos baixos: agora vê-se antes de jogar.

## 4.0.0 — Abertura

**No primeiro turno do jogo, a 2.ª recolha do primeiro jogador só pode ser de 1 carta.**

| Jogadores | 3.0.x | 4.0.0 | Justo |
|---|---|---|---|
| 2 | 51,5 / 48,5 | 50,5 / 49,5 | 50 |
| 3 | 35,8 / 31,7 / 32,6 | 34,7 / 32,3 / 33,0 | 33,3 |
| 4 | 27,0 / 23,8 / 24,0 / 25,3 | 25,9 / 25,3 / 23,4 / 25,5 | 25 |

A 2 e a 4 jogadores a vantagem do 1.º lugar desaparece (margem de ±1 ponto). A 3 jogadores desce de +2,5 para +1,4 pontos.

Alternativas testadas e postas de lado (4000 partidas): dar 1 carta aos outros jogadores ou só ao último (corrige de mais a 2 jogadores); limitar o 1.º turno do 1.º jogador a 1 território (corrige de mais a 3 e 4); proibir-lhe recolher 2 cartas no 1.º turno (corrige muito de mais).

Os bots são simples: confirmar com jogadores reais numa mesa de aprovação.

## 3.0.0 — Ronda completa

Quando alguém funda a 3.ª aldeia, joga-se até ao fim da ronda em curso: todos fazem o mesmo número de turnos. A 2 jogadores, o 1.º lugar desceu de 57% para cerca de 52%.
