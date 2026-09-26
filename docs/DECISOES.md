# Decisões de arquitetura

Registo curto das decisões do contrato do motor (formato ADR: contexto, decisão, consequências). Validadas em setembro de 2026, antes da Fase 1, com verificação nos repos dos 4 jogos a migrar (Bulbous, Capivaras, Nine Oils, Praia das Percebes).

---

## ADR-001: Moves imperativas sobre uma cópia do estado

**Estado:** aceite (2026-09-24)

### Contexto

Os 4 jogos a migrar mutam o estado diretamente (`p.hand.splice(...)`, `g.players[seat].fichas--`). Hoje, uma handler que muta e só depois falha, ou lança uma exceção, deixa o estado meio alterado (ex.: `BOY_DEFEND` do Nine Oils gasta Bullies antes de resolver). Do lado da rede, o cliente podia reenviar uma jogada depois de uma reconexão, ou jogar sobre um estado que já tinha avançado, e o servidor aplicava-a ao estado atual.

Alternativas consideradas: moves puras que devolvem estado novo (verboso, sujeito a bugs de aliasing, obriga a reescrever os jogos) e Immer (dependência no motor, sem ganho sobre a cópia).

### Decisão

- Cada move recebe um `structuredClone` do estado e altera-o diretamente. Só é confirmada se terminar sem `ctx.invalid` e sem exceção: tudo-ou-nada.
- Uma exceção nas regras é convertida em `engine.RULE_ERROR` (`{ type, message }`). O match fica intacto, a simulação regista-a como falha e o servidor escreve-a no log.
- O `MOVE` leva o `seq` do estado que o jogador viu. Se o match já avançou, o motor recusa com `engine.STALE_MOVE` e o servidor reenvia o `ROOM` atual.
- `client.move()` envia o `seq` automaticamente e devolve `false` quando não há ligação.

### Consequências

- A lógica dos jogos existentes passa quase linha a linha; o trabalho de migração é separar regras de lobby e broadcast.
- Uma jogada é idempotente: reenviada, não é aplicada duas vezes. O servidor é a única fonte de verdade e o cliente nunca fica à espera de um estado que não existe: ao reconectar recebe o último estado confirmado.
- Custo: uma cópia do estado por jogada (microssegundos nestes tamanhos).
- O `seq` no `MOVE` é opcional para o servidor (clientes antigos continuam a funcionar sem a proteção).

---

## ADR-002: Timers declarativos (`ctx.schedule` + `events`)

**Estado:** aceite (2026-09-24)

### Contexto

Os jogos atuais usam `setTimeout` dentro da lógica, protegido por `if (g.turnGen !== gen) return`. Os timers perdem-se num restart e não há replay nem simulação determinística. Nos 4 repos, a maioria dos `setTimeout` não são regras: são o ritmo dos bots, animações e a substituição de jogadores desligados. Só dois são regras: o desempate de 20 s do Bulbous (`tieBreakTimeout`) e a pausa de 5 s da revelação nas Capivaras (`REVEAL_MS`).

Alternativas consideradas: manter `setTimeout` nas regras (perde persistência, replay e simulação) e um evento `TICK` periódico com a hora real (suja o registo e obriga a guardar o relógio para o replay).

### Decisão

- As regras pedem tempo com `ctx.schedule(key, ms, EVENTO, payload)` e reagem em `events.EVENTO`. O motor guarda os timers no match; o servidor executa-os e guarda o prazo absoluto na sala.
- O `ROOM` inclui `timers: [{ key, event, at }]` e `now`, para a UI mostrar contagens decrescentes (a UI genérica já o faz).
- A simulação usa um relógio simulado com a mesma regra do servidor e dispara o timer que vence primeiro (antes disparava o primeiro da lista).
- `simulate({ idleRate })` põe os bots a deixar esgotar o tempo numa proporção das vezes, de forma determinística.

### Consequências

- Na migração, 2 timers passam a `events`; os restantes desaparecem, porque o servidor já trata do ritmo dos bots e dos lugares ausentes.
- Os cartões Gherkin da Fase 1 do tipo "Quando passam 20 s" têm teste: `fireTimer` num teste unitário, `idleRate` na simulação.
- As regras não sabem a hora: "quem respondeu primeiro" não pode ser regra. Nenhum dos 4 jogos precisa disso.

---

## ADR-003: Um RNG por match; bots num RNG derivado de `seed + seq + lugar`

**Estado:** aceite (2026-09-24)

### Contexto

O match guarda o estado do gerador (mulberry32, um inteiro) e as regras só tiram aleatoriedade de `ctx.rng`. Os 4 jogos a migrar usam `Math.random` para baralhar, lançar dados, escolher quem começa e nos bots. Na verificação apareceram dois problemas:

- os bots recebiam o estado completo, com a informação escondida. O bot atual das Capivaras já faz batota: lê a aposta secreta do outro bot (`g.bets[...]`) e evita essa carta;
- nada impedia um pacote de usar `Math.random` ou o relógio, e na Fase 1 o código vem da Forge.

Alternativas consideradas: os bots usarem o RNG do match (o que o bot "pensa" passaria a mudar os dados, e uma partida com bot divergia da mesma partida com humano) e RNG criptográfico sem seed (perde replay e simulação).

### Decisão

- Um RNG por match, guardado no match; a seed nunca sai do servidor.
- Os bots usam um RNG derivado de `seed + seq + lugar` e recebem `bot(view, seat, { rng, legal, numPlayers })`: veem o mesmo que um humano nesse lugar.
- `checkPurity(source, file)` no motor recusa `Math.random`, relógio, timers do sistema, rede, `process`, `require` e imports que não sejam `@bitnik/engine` ou `./`. Os testes de cada pacote correm-no sobre todos os ficheiros.
- Motor passa a `0.2.0` (a assinatura dos bots mudou); Catania passa a `3.0.1` (bot adaptado, regras iguais; a simulação de 1000 partidas dá exatamente os mesmos números).

### Consequências

- Na migração, `Math.random` → `ctx.rng` é mecânico; o cuidado é passar o `rng` às funções auxiliares (o `shuffle` global, o `drawCard` do Nine Oils que volta a baralhar o descarte).
- O bot das Capivaras tem de deixar de ler as apostas dos outros (passa a jogar só com o `view`).
- O mulberry32 tem 2³² estados (cerca de 4 mil milhões de baralhos possíveis). Chega para jogos de tabuleiro. **Não serve jogos a dinheiro**, que estão fora do âmbito da plataforma.

---

## ADR-004: Incompatibilidade por versão; avisos antes de um deploy

**Estado:** aceite (2026-09-24)

### Contexto

Cada match guarda a `gameVersion`. Ao arrancar, o servidor comparava só o primeiro número: mesas solo de outro major eram apagadas sem aviso e as públicas reiniciadas. Na verificação:

- em `0.x` nada era invalidado (`'0.1.0'` e `'0.2.0'` davam os dois major `'0'`), e os protótipos do Studio vão viver em `0.x`;
- a `engineVersion` era guardada mas nunca verificada;
- o jogador perdia a mesa solo sem saber porquê, e perdia-se o registo para reproduzir bugs;
- num runtime de cliente, cada deploy reinicia o processo. As partidas são guardadas e os clientes voltam a ligar-se, por isso só perde a partida quem está num jogo que mudou de versão incompatível; mas ninguém é avisado antes.

Nenhum dos 4 jogos a migrar guarda partidas hoje (tudo em memória): não há nada antigo a respeitar.

Alternativas consideradas: `migrate(state, fromVersion)` no pacote (cada mudança de regras obriga a escrever e testar migrações, difíceis de gerar pela Forge, para partidas que duram minutos) e manter duas versões instaladas ao mesmo tempo (ver abaixo).

### Decisão

- `compatibleVersions(a, b)`: semver à letra, incluindo `0.x` (compara o primeiro número não nulo). Aplica-se à versão do jogo e à do motor (`matchIncompatibility`).
- Mesas solo incompatíveis ficam `expired`: aparecem com o aviso, recusam jogadas (`server.EXPIRED`), podem recomeçar com a versão nova e guardam o match para replay. Mesas públicas voltam a "à espera".
- `replay` avisa quando a versão do jogo não é a da partida.
- Avisos do publisher: `platform.notify(...)` / `POST /admin/notices` (com `ADMIN_TOKEN`), enviados a todos os ligados (`NOTICES`) e no `WELCOME`, guardados no storage até `until`. Com `maintenance`, deixam de começar partidas novas dos jogos indicados (`server.MAINTENANCE`) e as que decorrem continuam.

### Consequências

- Um deploy anunciado com janela de manutenção chega à hora marcada com poucas ou nenhumas mesas a meio no jogo atualizado.
- No Studio, mudar o minor de um protótipo `0.x` expira as partidas de teste antigas.
- Sem `migrate` por agora: pode entrar mais tarde como hook opcional sem partir nada.
- **Evolução futura:** instalar duas versões ao mesmo tempo (`catania@3` e `catania@4`, indexadas por `id@major`, com aliases npm), para as partidas a decorrer acabarem na versão antiga. Elimina o kick por completo; rever quando houver um cliente com partidas longas ou muitos jogadores em simultâneo.

---

## ADR-005: `describeMove` no pacote, para a UI genérica

**Estado:** aceite (2026-09-24)

### Contexto

A UI genérica do Studio mostra as jogadas legais como botões, agrupados por tipo. O servidor pede ao pacote uma frase para cada uma (`describeMove(move, view)` → `{ key, params }`). Sem ela, o fallback era `move.TIPO`, sem payload, e todos os botões do mesmo tipo ficavam iguais. Se o `describeMove` lançasse uma exceção, partia o `ROOM` de toda a mesa.

Nos 4 jogos a migrar: Capivaras (apostar numa de N posições) e Praia (`PLACE_TILE {r,c}`) cabem bem numa lista de botões. Bulbous (apostas com subconjuntos da mão, sequências com permutações, ~150 opções) e Nine Oils têm demasiadas combinações para jogar à mão numa lista. O Nine Oils guarda também a seleção da UI no estado (`SELECT_CARD` → `g.sel`).

Alternativas consideradas: só convenção, sem função (não resolve frases que dependem do `view`, como o recurso de um hexágono no Catania) e um esquema declarativo das jogadas para gerar formulários (mini-linguagem a manter e a gerar pela Forge; custo alto para já).

### Decisão

- `describeMove` fica no pacote, opcional.
- O motor passa a ter `describeMove(game, move, view)`, usado pelo `viewFor` (as jogadas legais já vêm rotuladas para o servidor, o Studio e qualquer UI): primeiro o do pacote, depois `moveLabel.TIPO` com o payload como parâmetros, depois `move.TIPO`. Nunca lança.
- Estado de interface não entra no `state`: uma jogada é uma decisão completa.

### Consequências

- Jogos simples (Capivaras, Praia) só precisam das chaves `moveLabel.*` no i18n.
- A UI genérica chega para testar e aprovar jogos simples e serve bots e simulação para todos. Bulbous e Nine Oils vão precisar do seu tabuleiro portado para o SDK (como o Catania na Fase 0b); o `describeMove` continua a servir-lhes para o histórico.
- Na migração do Nine Oils, `SELECT_CARD` + `ROLL` passam a uma jogada só (`PLAY_CARDS { idx }`).
- O esquema declarativo das jogadas fica como opção a reavaliar na Fase 1, se a Forge precisar de gerar UI.

---

## ADR-006: A UI de um jogo vive no pacote e ocupa a área da mesa

**Estado:** aceite (2026-09-24), a implementar na Fase 0b. A moldura à volta da mesa foi substituída pela ADR-014.

### Contexto

O `catania-v2` tem todo o cliente num `index.html` de 2446 linhas: lobby, sala de espera, tabuleiro em SVG, modal de aldeia, vitória, sons e tutorial. Os 4 jogos a migrar têm o mesmo padrão, com lobby próprio. A plataforma já trata de lobby, identidade, reconexão, avisos e mesas de aprovação, na marca de cada deploy.

Alternativas consideradas: UI num pacote separado (`@bitnik/ui-catania`; duas versões a manter alinhadas, e regras e tabuleiro vendem-se juntos) e uma página inteira por jogo (cada jogo volta a ter lobby, avisos e reconexão próprios).

### Decisão

- A UI vem no pacote, em `ui/`, e é servida pela plataforma. Ocupa só a área da mesa; barra, avisos, lobby, sentar e começar continuam a ser da plataforma.
- Interface: um módulo com `mount(el, ctx)` e `update(msg)`. Recebe o `view` e as jogadas legais (já rotuladas) e envia jogadas pelo `@bitnik/client`. Não repete regras: um clique corresponde a uma jogada legal.
- A UI genérica passa a ser a implementação por omissão da mesma interface; no Studio há um "modo protótipo" para trocar.
- `checkPurity` continua a valer para as regras; `ui/` pode importar o SDK de cliente, nunca o servidor.

### Consequências

- O port do `catania-v2` fica com o tabuleiro, pilhas, torre, mãos, modal de aldeia e sons; lobby e sala de espera saem.
- A migração dos 4 jogos aproveita só a parte da mesa de cada um.

---

## ADR-007: O tutorial corre o motor verdadeiro no browser; cenários no pacote

**Estado:** aceite (2026-09-24), a implementar na Fase 0b

### Contexto

O tutorial do `catania-v2` (630 linhas) tem uma cópia própria das regras para jogar sem servidor, e já está desatualizada: acaba o jogo quando a vez volta a quem fundou a 3.ª aldeia, sem a regra de ronda completa da 3.0.0. Usa um tabuleiro fixo e uma situação a meio do jogo montada à mão.

Alternativa considerada: o tutorial jogar contra o servidor numa mesa solo (sem rede não funciona, o que choca com a PWA, e ocupa mesas no servidor).

### Decisão

- As regras são puras e correm no browser tal como estão. O servidor serve os ficheiros de regras do pacote e um import map resolve `@bitnik/engine`.
- O tutorial cria uma partida local e usa `applyMove` e `botMove`; nenhuma cópia de regras.
- Cenários no pacote: `setup` aceita `ctx.options.scenario` (ex.: `'tutorial'`, `'meio-de-jogo'`) e devolve esse estado. É o mesmo mecanismo que o "Dado…" dos cartões Gherkin vai usar na Forge; os testes podem partilhar os cenários.
- O guião (textos, destaques, passos) é UI e fica em `ui/`.

### Consequências

- O tutorial nunca diverge das regras; funciona sem rede.
- A consola pode usar o mesmo cenário para pré-visualizar a aparência de um jogo (ADR-008).

---

## ADR-008: Aparência e design à medida, em camadas

**Estado:** aceite (2026-09-24), a implementar na Fase 0b

### Contexto

A aparência de um jogo é tão relevante como as regras, para a Bitnik e para os publishers. O design system `bitnikgames-design-system` já separa tokens de base, semânticos (`--bg`, `--text`, `--brand-*`, `--font-*`) e de jogo (`--game-color-1..4` no `game-ui.css`). Era carregado do CDN a partir do `@main`, sem versão: qualquer alteração mudava no mesmo instante todos os deploys, incluindo os de clientes. O `catania-v2` tem uma paleta própria (dourado e pergaminho) sobre a forma e a tipografia do design system.

Alternativas consideradas: editar só em código (cada ajuste passa por um deploy e por alguém técnico) e editar direto no repo do design system (todos os deploys mudam ao mesmo tempo; um publisher não deve mexer no design system da Bitnik).

### Decisão

Três camadas de tokens e dois níveis de personalização, com o mesmo peso:

| Camada | Quem define | Onde vive |
|---|---|---|
| Design system | Bitnik | repo do design system, com versão fixa (`@v1.0.0`) |
| Marca (moldura) | publisher | config do deploy, editável na consola |
| Jogo (tabuleiro) | Bitnik por omissão, publisher pode sobrepor | `ui/skin.json` no pacote + sobreposições na consola |

1. **Aparência por tokens:** cores, fontes, raios e imagens (`url(...)`), editáveis na consola ("Aparência") com pré-visualização ao vivo do cenário do tutorial. Guardadas no storage do deploy; exportáveis e importáveis em JSON. Aviso de contraste abaixo de AA.
2. **Design à medida:** um tema completo do jogo, com CSS próprio e assets (arte do tabuleiro, cartas, texturas, fontes), em `ui/themes/<nome>/`. O CSS fica limitado à área da mesa, para não esconder avisos nem controlos da plataforma. O tema escolhe-se por deploy; os tokens continuam a poder ser afinados por cima.

A UI de um jogo nunca usa cores escritas diretamente no código: só tokens, para as duas vias funcionarem.

Toda a skin define `--table-bg`, o aspeto da mesa onde o jogo assenta (cor, gradiente ou imagem). A plataforma aplica-o à área da mesa de qualquer jogo; é o primeiro campo da "Aparência". No Catania é o mar do `catania-v2`.

### Consequências

- Um publisher afina a skin sem deploy; um designer pode redesenhar a mesa inteira sem tocar nas regras.
- Na migração, cada jogo ganha um `skin.json` com a paleta que já tem, e os temas que fizerem sentido.
- Mudar o design system passa a ser uma versão nova, adotada deploy a deploy.

---

## ADR-009: A Forge vive na consola do Studio

**Estado:** aceite (2026-09-25), a implementar na Fase 1

### Contexto

Há dois protótipos anteriores. O `bitnik-studio` (agosto) descreve os jogos em BGE, um grafo JSON executado por um motor genérico. O `bitnik-logic` / Rule Forge (setembro) é um ficheiro HTML com quatro separadores: Fluxo (nós DATA/FLOW/ACTION/SCORE), Cartões Gherkin (com tipo e âmbito), documento de Regras e Gerar & Rever (prompt para uma IA gerar um PWA de ficheiro único). Os projetos do Rule Forge vivem no `localStorage` de um browser.

Alternativa considerada: manter o Rule Forge à parte com um botão "Enviar para o Studio" (duas ferramentas a manter em sincronia, projetos presos a um browser, validação longe de onde se escreve o cartão).

### Decisão

A Forge passa a ser uma secção da consola do Studio (atrás do `ADMIN_TOKEN`), com o Rule Forge portado: fluxo, cartões, regras e geração. Os projetos ficam guardados no servidor (`/admin/forge/*`) e importam-se os projetos JSON do Rule Forge (`{ nodes, edges, cards, rules, commits }`). Só existe no Studio, nunca nos runtimes dos clientes.

### Consequências

- Do cartão ao jogo testável num só sítio. O Rule Forge continua disponível enquanto a migração não fica completa.

---

## ADR-010: A Forge gera pacotes do contrato

**Estado:** aceite (2026-09-25)

### Contexto

O Rule Forge gera um PWA descartável: não entra na plataforma (sem lobby, bots, simulação, mesas de aprovação) e não se vende. O BGE declarativo exigia programar o motor para cada mecânica nova; dos 5 jogos em BGE só 2 chegaram a correr.

### Decisão

A Forge gera um pacote igual ao Catania: `index.js`, `rules.js`, `i18n/pt.js` e `en.js`, `test/` (testes dos cartões e da partida narrada), `REGRAS.md` e `forge.json` (o projeto de origem, para voltar a gerar). O `enumerate` é obrigatório. Joga-se logo na UI genérica; o tabuleiro próprio vem depois (ADR-006/008).

### Consequências

- Um protótipo aprovado vende-se tal como está.
- Na Fase 2, a Forge pode gerar os 4 jogos a partir dos seus cartões, com o código atual como referência no prompt.

---

## ADR-011: Gerar por copiar/colar com verificação automática; a API é opcional

**Estado:** aceite (2026-09-25)

### Contexto

Gerar código a partir de cartões em prosa livre exige uma IA. A geração direta pela API precisa de uma chave e tem custo por geração.

### Decisão

- Caminho principal: a Forge monta o prompt, o designer usa a IA que quiser e cola o resultado. Tudo o que é colado passa pela verificação automática (contrato, pureza, testes dos cartões, partida narrada, simulação).
- A geração pela API (Claude, a partir do servidor do Studio, com a chave só aí e até 3 voltas de correção automática) entra como opção quando se quiser.
- **Hipótese a verificar na Fase 2:** uma biblioteca de blocos de mecânicas (baralho, ordem de turno, apostas simultâneas, maioria…) que nasce da migração dos 4 jogos, para gerar sem IA os jogos que só usem blocos conhecidos. Se se concluir que não é viável, fica registado porquê e não se faz.

### Consequências

- Sem chave nem custos de API para começar; a IA continua a ser precisa, mas é a do designer.

---

## ADR-012: Partida narrada e testes antes do código

**Estado:** aceite (2026-09-25)

### Contexto

Corrigir lógica de jogo depois de haver código custa muito. Se a IA escrever testes e código de uma vez, pode escrever testes que confirmam os próprios erros.

### Decisão

A ordem da Forge é: **cartões → partida narrada → commit das regras → testes (o designer aprova) → código → verificação → jogar no Studio.**

1. **Partida narrada:** a IA joga uma partida inteira em texto, jogada a jogada, com o cartão aplicado e o estado depois de cada jogada. Onde as regras não cobrem a situação, marca uma **dúvida** ("os cartões não dizem X; assumi Y") em vez de inventar. O Studio mostra a partida numa linha do tempo, com as dúvidas ligadas aos cartões. O designer corrige e faz commit das regras; repete-se até não haver dúvidas. Podem pedir-se partidas de casos difíceis (fim do jogo, empates, número de jogadores).
2. **A partida aprovada passa a teste de ponta a ponta:** o código tem de jogar essa sequência e chegar aos mesmos estados.
3. **Categoria de cada cartão:** *regra* (vira teste), *plataforma* (tratado pela plataforma: desligar, avisos, tempos) ou *bot* (só se testa que o bot faz jogadas válidas).
4. **Testes primeiro:** a IA escreve os testes a partir dos cartões, lidos como Dado / Quando / Então; o designer aprova e ficam fixos entre gerações. Só depois vem o código, que tem de os passar.
5. **Cobertura:** cada teste mostra o cartão de origem; cartões sem teste e testes sem cartão ficam assinalados.

### Consequências

- Os erros de regras apanham-se em texto, onde corrigir é barato.

---

## ADR-013: Versões dos protótipos, instalação a quente e publicação

**Estado:** aceite (2026-09-25)

### Decisão

1. Cada commit de regras sobe o minor do protótipo (`0.1.0` → `0.2.0`); pela ADR-004, as partidas de teste antigas ficam "versão antiga". Correções só de texto sobem o patch (`0.2.1`).
2. O pacote aceite entra no Studio sem reiniciar, com a etiqueta "Protótipo 0.x" no lobby e na consola. As versões anteriores ficam guardadas para comparar e fazer replay.
3. As mesas de aprovação ficam associadas à versão com que se jogou.
4. **Publicar:** o pacote passa a `games/<jogo>` no repositório como `1.0.0`, com commit; a partir daí vai para clientes como o Catania.

### Consequências

- O código gerado corre dentro do servidor do Studio. Antes de entrar é verificado num processo isolado (sem rede, com limite de tempo) e só o designer instala. Um erro nas regras é recusado como `RULE_ERROR`; um ciclo infinito ainda pode parar o Studio até reiniciar (risco aceite num estúdio interno). Os runtimes dos clientes só recebem pacotes publicados.

---

## ADR-014: A mesa ocupa o ecrã inteiro; painéis de vidro por cima

**Estado:** aceite no desenho (2026-09-26); por implementar na UI genérica

### Contexto

O template vanilla foi afinado no Claude Design (canvas "Bitnik — Template vanilla", ver `design/figma/TEMPLATE.md`). O desenho afasta-se da ADR-006 num ponto: a plataforma deixa de desenhar uma moldura (barra, faixa de avisos, título e botões) à volta da área da mesa. Nos jogos de tabuleiro online a mesa é o ecrã, sobretudo no telemóvel, e a moldura gastava cerca de um quarto da altura.

### Decisão

- A mesa (`--table-bg`) ocupa o ecrã inteiro. Marca, nome do jogo, guia, voltar ao lobby e língua ficam numa linha discreta por cima da mesa.
- Jogadores, fichas da ronda, a minha área, barra de ações, registo e controlos da vista são painéis de vidro por cima da mesa, em posições fixas (secção 3 do TEMPLATE). O tabuleiro é uma mesa infinita com mover e zoom.
- Os componentes de cada jogador (cartas, tokens, aldeias…) são botões e servem de alvo quando uma ação escolhe um jogador.
- A **mensagem da mesa** ("É a tua vez", eventos, avisos, fim) é da plataforma: o jogo só manda o texto e a variante.
- Fora da mesa, os ecrãs (Início com vários jogos, Marca-produto com um só jogo, Lobby, Entrada, Fim e Relatório) seguem o mesmo fundo e o mesmo vidro.
- Os tokens novos (vidro, texto sobre a mesa, destaque forte, desativado) estão no `design/vanilla/skin.json`.
- Mantém-se da ADR-006: a UI de um jogo vive no pacote, com `mount(el, ctx)` e `update(msg)`; lobby, sentar, começar, identidade e avisos são da plataforma.

### Consequências

- A UI genérica (`packages/server/public/app.js` e `app.css`) tem de ser refeita para este desenho; a UI do Catania adapta-se aos painéis de vidro.
- Os avisos de atualização deixam de ter faixa própria: falta decidir onde aparecem (proposta: uma ficha na linha de cima, que abre o texto).
- O contrato ganha dois acrescentos opcionais, a definir no `CONTRATO.md` antes de implementar: mensagens da mesa (texto e variante, a partir dos eventos) e o relatório do fim (pontos por origem e momentos decisivos).
- Antes de implementar, resolver os pendentes do TEMPLATE (secção 5): contraste do vidro e alvos de toque de 44 px.
