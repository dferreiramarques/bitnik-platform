# Nine Oils — histórico de regras

## 1.1.21 — Combinações com várias partes: atribuir cada parte aos dados (2026-10-01)

Sem mudanças de jogo: corrige um caso em que um lançamento com uma
combinação de várias partes (ex.: dois Quads, ou Triplo + Duplo) só
contava uma — selecionar todos os dados de uma vez tornava fácil
perder a conta de quais já estavam escolhidos, com dados iguais lado a
lado.

Agora escolhe-se aos grupos: seleciona-se os dados de uma parte (ex.:
os 4 de um Quad) e "Atribuir" fecha-a — fica com um contorno próprio
(uma cor por parte), distinto da seleção ainda por atribuir. Repete-se
para a parte seguinte; "Continuar" acende quando as partes já
atribuídas, mais o que estiver selecionado na hora, batem certo com
uma das combinações disponíveis (não é preciso atribuir a última
parte). Clicar outra vez num dado já atribuído desfaz essa parte, para
corrigir.

## 1.1.20 — Animações só uma vez; carta revelada até decidir; ficha das combinações (2026-10-01)

Sem mudanças de jogo:

- O lançamento dos dados só anima a primeira vez que aparece — voltar a
  desenhar os mesmos dados (clicar noutro para escolher a combinação,
  abrir o registo) já não repetia a animação sem razão.
- A zona "Lançar os dados" só aparece (com um fade) depois de a
  mensagem "é a tua vez" acabar, em vez de ao mesmo tempo.
- A carta revelada do adversário (quando joga um Rapaz ou 2 Valentões)
  deixa de desaparecer ao fim de 5 segundos fixos nesses casos — fica
  visível até a fase de defesa ou de escolha às cegas acabar.
- As combinações disponíveis (fase COMBO) deixam de flutuar à direita
  dos dados; passam a uma ficha expansível/colapsável encostada aos
  cartões dos jogadores, ao centro, como a pilha de valores do Catania
  — com fundo em vidro quando aberta, já que fica por cima dos dados.
- Texto das mensagens da mesa mais pequeno no telemóvel (ajuste na
  plataforma, `app.css`: afeta todos os jogos, não só o Nine Oils).

## 1.1.19 — Defesa e combinação pelos próprios componentes; bot mais devagar (2026-10-01)

Sem mudanças de jogo:

- Animação do dado ao dobro da velocidade (0,9s → 0,45s).
- Fase CARTAS: a zona "Lançar os dados" desaparece por completo na vez
  do adversário (antes ficava visível, só desativada). A carta
  revelada do adversário já não se sobrepõe ao texto da mensagem da
  mesa (desce para debaixo do centro do ecrã).
- Fase DEFESA: sem botões "Bloquear com N Valentão(ões)" — seleciona-se
  os Valentões da mão (até ao número de Rapazes a bloquear) e confirma-se
  com um botão "Continuar", como nas combinações.
- Fase COMBO: em vez de uma lista de botões, clica-se nos próprios
  dados lançados para formar a combinação; "Continuar" só acende
  quando a seleção corresponde a uma das opções. As combinações
  disponíveis ficam visíveis aos dois jogadores num painel informativo
  (como a pilha de valores do Catania), nunca como botões. No Joker (7
  iguais), sem um grupo de dados literal para "Triplo + Duplo", mantém-se
  a lista de botões.
- Modal "Como se joga": imagens dos dados e das cartas a ilustrar as
  combinações e as cartas de personagem.
- O bot espera 3 segundos entre jogadas (antes, 0,7–1,4s, tempo a mais
  quando um turno é vários passos seguidos: lançar, escolher combo,
  descartar). Acrescenta `botDelayMs` ao contrato de um jogo (opcional;
  por omissão continua [700, 1400] para os outros).

## 1.1.18 — Dado em "flipbook"; combinações junto aos dados; sem mensagens que empurrem o ecrã (2026-10-01)

Sem mudanças de jogo:

- O dado deixa de ser um cubo em 3D (dava só 1 face legível) e passa a
  um "flipbook": percorre as 6 faces fotografadas, uma a cada passo,
  com desfoque de movimento (mais forte a meio, a limpar no fim) e um
  leve sobe-desce de 3px, até assentar na face lançada.
- As combinações (fase COMBO) saem da linha própria e passam para
  dentro do centro, logo a seguir aos dados — não há espaço vazio nem
  outra "zona" a meio do ecrã.
- A última mensagem que ainda empurrava o ecrã ao aparecer (o aviso de
  "escolhe às cegas", na fase ESCOLHA_CEGA) passa à mesa, como as
  outras — nenhuma mensagem nesta UI mexe mais em componentes do ecrã.

## 1.1.17 — Registo flutuante a sério; dado com 3 faces e desfoque; descarte por mensagem (2026-10-01)

Sem mudanças de jogo:

- O registo estava dentro da linha de baixo e, ao abrir, empurrava a
  mão — não flutuava a sério, apesar de já estar documentado assim no
  `design/figma/TEMPLATE.md` (corrigido e propagado a todos os
  templates: Bulbous, Capivaras, Catania, Praia das Percebes e também
  ao template vanilla, já que é uma correção da base, não do Nine
  Oils). Passa a sobrepor-se (canto inferior esquerdo) sem afetar o
  resto do ecrã; no telemóvel continua sem aparecer, como já era em
  todos os jogos.
- O dado em 3D só mostrava a face lançada direita de frente (1 face
  visível) — ganha uma inclinação fixa para se verem sempre 3 faces,
  como um dado a sério, e um desfoque de movimento durante a rotação.
  De caminho, corrige um efeito secundário: sem um transform estático
  igual ao fim da animação, o dado "saltava" de volta à face 1 assim
  que a animação acabava (ou com as animações desligadas).
- A casa da banca com garrafa ficava com a cor de destaque (laranja/
  vermelho, a mesma de "bloqueada") — fica verde, mais clara enquanto
  estado positivo.
- Fase de descarte: sem o aviso "Clica no X..." numa caixa por baixo —
  a mensagem passa à mesa, como as outras ("Tens mais que 3 cartas.
  Descarta."), só quando se entra na fase (não a cada atualização).

## 1.1.16 — Dados em 3D; mensagens na mesa; sem status genérico (2026-10-01)

Sem mudanças de jogo:

- Os dados passam a um cubo em 3D com as 6 faces fotografadas, a rodar
  até à face lançada (antes eram a imagem plana, sem rotação).
- Combinações: cada botão passa a ter o próprio preenchimento em vidro
  (sem painel por baixo).
- Casas livres da banca com mais contraste (linha castanha em vez de
  quase branca sobre o pergaminho).
- Mensagens na mesa (como o Penta já tinha): o combo que saiu no
  lançamento do adversário (ou "sem combinação"), quantas cartas jogou,
  e "é a tua vez" quando o turno passa para ti. A carta que o
  adversário jogou (informação pública, vai para o descarte) aparece
  em grande por 5 segundos.
- Sai o aviso genérico "Vez do adversário…" a meio do ecrã: a vez do
  adversário mostra-se com os dados e as mensagens acima, não com um
  status fixo em baixo (incluindo um caso em que esse aviso aparecia
  por engano a pedir para escolher às cegas uma carta que não era tua
  para escolher).

## 1.1.15 — Jogar cartas por seleção; cartão do jogador em pergaminho (2026-10-01)

Sem mudanças de jogo:

- Fase de lançar: em vez de uma barra com um botão por combinação de
  cartas, toca-se nas cartas da mão para as selecionar (ficam destacadas
  e sobem, como a ir na direção dos dados) e toca-se na zona dos dados
  para lançar com o que estiver selecionado. Dois cliques numa carta
  abrem sempre os detalhes (antes bastava um clique).
- As combinações da fase de escolha (COMBO) deixam de aparecer na barra
  de baixo e passam a um painel flutuante em vidro, entre os dados e a
  mão.
- Dados maiores (64px) e cartas da mão maiores (130×176), a ocupar a
  zona toda por baixo dos dados.
- Cartão do jogador com fundo em pergaminho (design do David) em vez do
  vidro escuro; texto e contornos passam às cores de texto escuro
  (--game-text/--game-muted/--game-line) para manter o contraste.

## 1.1.14 — Fundo da mesa e dados próprios (2026-10-01)

Sem mudanças de jogo: primeiro passo do visual a sério deste pacote
(agora separado da demonstração do template em `nine-oils-vanilla`).
`--table-bg` passa a ser uma imagem própria (`ui/table-bg.webp`), em
vez do gradiente verde do vanilla. Os dados deixam de ser pintas CSS
numa grelha 3×3 e passam a mostrar a face fotografada de um dado a
sério (`ui/dados/1.png` a `6.png`).

## 1.1.13 — Fundo do lobby sem precisar de campo (2026-10-01)

Sem mudanças de jogo: o `cover` da 1.1.12 era uma imagem estática a
tentar imitar o fundo da mesa — sai do contrato outra vez. O fundo do
lobby passa a ser sempre o `--table-bg` do jogo, escurecido (igual ao
Catania e aos outros jogos), automaticamente, sem nenhum campo.

## 1.1.12 — Imagem do lobby (2026-10-01)

Sem mudanças de jogo: acrescenta `cover` ao contrato — o mesmo
gradiente do fundo da mesa em jogo (`--table-bg` do skin.json), usado
como fundo escurecido do lobby na plataforma e miniatura na página da
marca, como o Catania já tinha.

## 1.1.11 — Regras numa modal; banca numa só linha; X do descarte dentro da carta (2026-09-30)

Ganha o botão "?" com as regras do jogo numa modal (`ui/rules-text.js`, PT
e EN), como o Catania — não existia nenhum atalho de regras até aqui.

Sem mudanças de jogo, no resto: as 6 casas da banca deixam de partir em
2 linhas no telemóvel (encolhem o suficiente para caberem sempre numa só).
Removidos "{pontos}/6" e "Reserva: {n}" do cartão do jogador — informação
repetida com as próprias casas da banca. O X de descarte passa para
dentro dos limites da carta (estava a sair pelo canto). Acrescenta um
layout horizontal (telemóvel/tablet deitado) com os jogadores à esquerda,
como as Capivaras.

## 1.1.10 — Cor do registo volta ao texto da mesa (2026-09-29)

Sem mudanças de jogo: o registo deixa de ser branco fixo e volta a usar
`--game-on-table-muted`, a mesma cor dos outros textos secundários sobre a
mesa.

## 1.1.9 — Registo mais discreto; começa fechado (2026-09-29)

Sem mudanças de jogo: o texto do registo passa a branco, fino e pequeno,
sem sombra — um log discreto. Deixa de ter scroll (o conteúdo mais antigo
corta, não se vê). Começa sempre fechado.

## 1.1.8 — Registo cresce até meio ecrã (2026-09-29)

Sem mudanças de jogo: o registo passa a crescer com o conteúdo até 50% da
altura do ecrã e só a partir daí desliza, em vez de cortar nas últimas 5
entradas (mesmo comportamento em todos os jogos, `design/figma/TEMPLATE.md`).

## 1.1.7 — X de descarte no canto da carta (2026-09-28)

Sem mudanças de jogo: no descarte, a carta em si continua a abrir os
detalhes ao clicar, mas ganha um X vermelho no canto superior — é esse X,
não a barra de jogadas, que descarta a carta.

## 1.1.6 — A mão mostra a arte, em dobro, sem o botão "?" (2026-09-28)

Sem mudanças de jogo:

- As cartas da mão mostram a arte original (não o emoji), no dobro do
  tamanho de antes (a jogar continua a sair da barra de jogadas).
- O botão "?" desaparece: clicar na própria carta abre sempre os detalhes
  (a jogada de a descartar, antes só ao clicar na carta, passa a estar na
  barra de jogadas como as outras, para não conflituar com o clique).
- O modal de detalhes já não corta a imagem: painel mais largo e a arte
  em `object-fit: contain`.

## 1.1.5 — Emoji, dados animados e sem pausa manual (2026-09-28)

Sem mudanças de jogo:

- Emoji trocados a pedido do David: Sedutora ❤️‍🔥 (era 💃), Rapaz 👦🏽 (era
  🤏), Valentão 💪🏼 (era 👊), garrafa da banca 🧪 (era 🍾). `describeMove` no
  `rules.js` também mudou, por isso a UI genérica de qualquer prototípo
  futuro herda os novos emoji automaticamente.
- Dados como pintas num dado a sério (grelha 3×3), com uma leve animação de
  entrada e cores alternadas, em vez de números a preto e branco.
- A pausa "ver os dados" (fase PAUSA, jogada Continuar) deixa de pedir um
  clique: a UI própria manda a jogada sozinha meio segundo depois de
  mostrar os dados. A jogada Continuar continua a existir no contrato
  (para o replay e para a UI genérica), só deixou de aparecer como botão.
- O modal de detalhes da carta (1.1.3) mostra a arte a ocupar toda a
  altura do modal, não só uma faixa estreita.

## 1.1.4 — Arte das cartas no modal de detalhes (2026-09-28)

Sem mudanças de jogo: o modal de detalhes (1.1.3) passa a mostrar a arte
ilustrada de cada carta (`ui/cartas/{boy,bully,temptress}.jpg`, fornecida
pelo David), em vez do emoji. O emoji continua como recuo automático se a
imagem não carregar.

## 1.1.3 — Detalhes da carta (2026-09-28)

Sem mudanças de jogo: cada carta da mão ganha um botão "?" que abre os
detalhes (quando jogar, efeito completo e a frase de sabor), tal como no
jogo online antigo (nineoils.up.railway.app). O texto vem do `REGRAS.md`;
a arte (`ui/cartas/*.png`) ainda não estava no pacote — sem ela, o modal
mostrava o emoji da carta em grande.

## 1.1.2 — UI própria, no template vanilla (2026-09-28)

Sem mudanças de jogo: primeira UI própria do Nine Oils (ADR-006), sem tokens
próprios (`ui/skin.json` é uma cópia de `design/vanilla/skin.json`), para
mostrar a clientes o aspeto de base da plataforma. Banca de 6 casas por
jogador, mão com os mesmos emoji do registo (💃🤏👊), dados do lançamento e
escolha às cegas como cartas viradas para baixo. Deixa de usar a UI genérica
de protótipo.

## 1.1.1 — Mensagem da mesa no Penta (2026-09-28)

Sem mudanças de jogo: o Penta (5 dados iguais, ~5% dos lançamentos; o adversário descarta a mão toda) passa a aparecer também como mensagem da mesa ("Penta!"), não só uma linha no registo, que mantém a frase completa (`ctx.log('log.PENTA', {}, { announce: { variant: 'warn', key: 'msg.PENTA' } })`, ADR-014). O Nove (vitória instantânea) não ganhou mensagem: coincide sempre com o resultado, que já mostra o vencedor.

## 1.1.0 — 2 Rapazes (2026-09-26)

- **2 Rapazes** (8 cartas de Personagem), como nas regras escritas. Simulação com 20 000 partidas por versão: quem começa ganha 53,1% com 2 Rapazes e 53,7% com 3; há metade dos roubos (0,36 contra 0,76 por partida). Não desequilibra.
- Na escolha de combinações, as melhores (as que nenhuma outra opção contém) aparecem primeiro e com ★.

## 1.0.0 — Migração para a plataforma (2026-09-26)

Regras migradas do servidor antigo (repositório `nineoils-v2`, `server.js`, v1.4), sem mudanças de jogo. `REGRAS.md` é a edição portuguesa do README antigo. Bot igual ao antigo (joga Sedutoras ou um Rapaz, escolhe a melhor combinação, bloqueia sempre que pode, nunca usa 2 Valentões para atacar).

Para rever:

- O baralho do jogo antigo tinha 3 Rapazes (resolvido na 1.1.0: 2).
- Quando um lançamento dá várias opções, a lista inclui também conjuntos com menos combinações (resolvido na 1.1.0: as melhores com ★).
- A pausa depois de lançar (para os dois verem os dados) é uma jogada, "Continuar" (resolvido na UI, 1.1.5: a mesa avança sozinha ~1s depois de mostrar os dados, sem botão manual).

Vitórias por lugar em simulação com bots (1000 partidas, quem começa é sorteado): 48,8 / 51,2.

Por fazer: UI própria (por agora usa a UI genérica de protótipo).
