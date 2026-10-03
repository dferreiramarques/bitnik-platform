# Contexto para uma nova conversa

Resumo do estado da plataforma e do que foi feito até 02/10/2026, para começar uma conversa nova sem perder o fio. O detalhe está em `README.md`, `docs/CONTRATO.md`, `docs/ROADMAP.md` e `docs/DECISOES.md`; este ficheiro diz onde está cada coisa e o que ainda falta.

## O que é

- A Bitnik Games (David Marques, game designer e publisher) tem uma plataforma de jogos de tabuleiro online com duas faces:
  - **Bitnik Studio** (`apps/studio`): a instância da Bitnik, onde se criam, testam e aprovam jogos. Inclui a consola (`/console`) e a Forge.
  - **Runtime** (`examples/clean-runtime`): um deploy por publisher cliente, só com os pacotes de jogo vendidos.
- Cada jogo é um pacote em `games/*` que só importa `@bitnik/engine` e ficheiros próprios. Há um teste que o verifica.
- Jogos:
  - Catania, com UI própria no template;
  - Capivaras, com UI própria no template desde a 2.0.0 (com o baralho e a arte do jogo original, do repositório `dferreiramarques/capivaras`);
  - Bulbous, Praia das Percebes (com arte própria das peças), Nine Oils, Robot Maker, com UI própria no template, e Startup Panic (UI própria em `games/startup-panic`);
  - Nine Oils (Vanilla Demo), cópia congelada do Nine Oils que mostra o template vanilla tal como foi desenhado (escondida da página da marca).

## Onde está

| O quê | Onde |
| --- | --- |
| Código | `github.com/dferreiramarques/bitnik-platform` (ramo `main`) |
| Site live | Railway, com deploy automático de `main` (ver "Pôr o Studio na internet" no `README.md`) |
| Desenho do template | Claude Design, canvas "Bitnik — Template vanilla": <https://claude.ai/artifact/9yZPAYkg1bMhpgzWKrLgpX> |
| Guião do desenho | `design/figma/TEMPLATE.md` |
| Proposta comercial para publishers | Claude Docs, "Bitnik — O seu jogo de tabuleiro, online": <https://claude.ai/code/artifact/d6d8f6ee-d108-41b4-80fc-ac9bf20f3fb7> |

## Estado das fases

- **Feitas:**
  - Fase 0: motor, servidor, SDK, Catania, Studio e runtime limpo;
  - Fase 0b: UI do Catania e template vanilla;
  - Fase 0c: consola.
- **Em curso:**
  - Fase 1: Forge completa até à publicação; falta só a geração pela API, que é opcional;
  - Fase 2: os jogos migrados já têm UI própria no template; falta rever pontos do CHANGELOG de cada um e a secção "Clientes" na consola.
- O que falta em cada fase está em `docs/ROADMAP.md`.

## O que mudou nas últimas sessões

**Início de outubro de 2026 (PRs #18 a #39).**
- **Tutoriais:** guia da plataforma `ctx.tour` e partida local `ctx.session` (ADR-018), em todos os jogos; botão "Tutorial" à parte de "Como se joga".
- **PWA instalável:** ícones PNG e botão "Instalar app" no lobby de cada jogo.
- **Design system da Bitnik** dentro da plataforma, numa versão fixa (ADR-017): sem CDN, funciona offline.
- **Lobby:** mesas públicas e de convite acabadas libertam o lugar ao sair (ADR-016).
- **Jogos:** Robot Maker 2.1.0, Startup Panic 3.4.0 (bots a sério, cartões compactos), Praia das Percebes 2.1.1 (arte das peças, cores vivas, peça e tabuleiro inicial maiores).
- As ADR-018 a ADR-021 foram renumeradas (havia três com o número 018).

**Até ao PR #17.**

**Mesa em ecrã inteiro (ADR-014).**
- O Catania corre live no template: painéis de vidro por cima da mesa e tabuleiro numa camada em ecrã inteiro, por baixo da UI.
- O layout segue o tamanho da mesa (container queries). Por isso a mesma UI serve o ecrã inteiro, o tutorial e a pré-visualização da consola.
- As classes da mesa da plataforma chamam-se `mesa-*`. Com `tbl-*` apanhavam as tabelas da consola, e um teste impede que isso volte a acontecer.

**Catania.**
- **Tabuleiro e zoom:** zoom com pinça, roda e botões. A "zona livre" onde a ilha encaixa é medida uma vez e fica fixa enquanto o ecrã não mudar de tamanho. Assim o tabuleiro não salta quando os painéis mudam de altura.
- **Animações:**
  - fogo a arder;
  - hexágonos a pulsar quando se escolhe o fogo;
  - espuma do mar na costa, com o desenho de onda do David, a vir do mar para a ilha.
- **Animações contínuas:** todas usam `animation-delay` negativo, calculado a partir de um relógio contínuo. Não recomeçam quando a UI é redesenhada.
- **Tutorial:**
  - não mostra as mensagens da mesa;
  - o jogador chama-se "Jogador";
  - usa as traduções do próprio pacote quando a cache do browser está desatualizada.

**Telemóvel.**
- Os jogadores ficam numa faixa com swipe, em vez do botão "+N". O mesmo vale para a UI genérica.
- Ao entrar numa mesa, a página passa a ecrã inteiro, porque tem de ser pedido num toque do jogador. Ao voltar ao lobby, sai do ecrã inteiro.
- Os botões de zoom estão escondidos, mas continuam no layout.
- O cabeçalho está encostado ao topo.
- As páginas não usam `viewport-fit=cover`. No OPPO A60 isso fazia descer o cabeçalho.

**Fora da mesa.**
- **Início (`#/`):** quando há mais de um jogo, é a página da marca, em laranja Bitnik, sem scroll vertical.
- **Lobby de cada jogo (`#/j/<jogo>`):** "Contra bots" ocupa a largura toda, e as mesas com outras pessoas têm pontos por lugar.
- **Entrada na mesa:** também usa o template.
- **Rotas:**
  - `#/` é o Início;
  - `#/j/<jogo>` é o lobby do jogo;
  - `#/r/<mesa>` é a mesa;
  - `#/tutorial/<jogo>` é o tutorial.
- **Campo do nome:** guarda o que se escreve e sobrevive aos redesenhos (`saveName`, `nameDraft`).

**Modo protótipo.**
- Só existe no Studio, para jogos marcados como protótipo com UI própria.
- Aplica-se só à mesa onde é ligado e não fica guardado. Depois de publicado pela Forge, o jogo não tem modo protótipo.

**Consola.**
- Aparência: as cores com transparência (rgba) podem usar o seletor de cor sem perder a transparência.
- A pré-visualização da Aparência tem altura própria.
- Aparência › Animação (`public/animation.js`): cada token `image` do skin.json pode ter uma animação ("Dice Roll" ou "Burning") e vários frames (o frame 1 é o token; o `+` junta mais, até 8). Fica em `appearance.games[id].anims[token]`. A mesa não muda: `watchAnimations` anima as `<img>` cujo `src` é o frame 1 do token (o Praia desenha assim as peças). Os efeitos estão em `app.css` (`.anim-*`). Só cobre `<img>`; fundos CSS e SVG ficam para depois.
- Movimento (`public/motion.js`, tokens `--motion-fast`/`--motion-ease`): `.fx-in`/`.fx-out` e `afterLeave` para modais, painéis e avisos entrarem e saírem com fade curto; só a renderização que abre leva `.fx-in`, para os redesenhos não a repetirem.

**Deploy.**
- O Railway arranca com `npm start` e usa o `railway.json`, com o healthcheck em `/health`.
- `ADMIN_TOKEN` dá acesso à consola.
- Os dados ficam em `DATA_DIR=/data/studio`, num volume montado em `/data`.
- O servidor fecha de forma ordenada quando recebe SIGTERM.

**Desenho.**
- O canvas do template foi alinhado com o live:
  - Início, lobby e entrada com o fundo da marca;
  - botão principal claro;
  - "Contra bots" a toda a largura;
  - faixa de jogadores com swipe;
  - zoom escondido no telemóvel;
  - cabeçalho encostado ao topo.
- O código não depende do canvas: o canvas é a referência para as UIs dos outros jogos.

## O que falta (por ordem provável)

1. **UI genérica com o desenho do template.** Antes, resolver os pendentes da secção 5 do `design/figma/TEMPLATE.md`:
   - contraste do vidro;
   - alvos de toque;
   - peças que o Catania pediu.

   Acrescentar também ao `docs/CONTRATO.md` as mensagens da mesa e o relatório do fim.
2. **Rever os pontos do CHANGELOG** de cada jogo migrado. As UIs próprias já existem; o Capivaras serve de modelo para um jogo sem tabuleiro: `games/capivaras/ui/`.
3. **Geração pela API na Forge.** É opcional.
4. **Secção "Clientes" na consola**, quando houver runtimes em produção.
5. **Pacote instalável para publishers** (modelo A da proposta): Dockerfile e guia para cPanel com Node ou VPS. Só quando fechar o primeiro cliente.

## Proposta comercial (resumo)

A proposta porta jogos já publicados para a plataforma: não inclui game design, equilíbrio nem playtesting.

| Jogo | Preço | Prazo |
| --- | --- | --- |
| Simples | 1.490 € | 2 semanas |
| Médio | 2.290 € | 3 semanas |
| Complexo | 3.790 € | 4–5 semanas |

A partir do 2.º jogo há 10% de desconto.

Modelos de entrega:

| Modelo | Preço | Mensalidade |
| --- | --- | --- |
| A. Pacote para instalar (Node 22.13+ com WebSockets) | 390 € | nenhuma; versões novas a 150 € |
| B. Alojado pela Bitnik, no domínio do cliente via CNAME | 190 € de setup | 29 €/mês ou 290 €/ano |
| C. Jogo e revamp do site do cliente | desde 1.990 € | 49 €/mês ou 490 €/ano |

**Custos internos:** um dia de trabalho custa cerca de 238 €, com o limite de 5.000 €/mês em RH, mais o custo da IA.

## Como trabalhar

- **Comandos:**
  - `npm install`;
  - `npm test` (287 testes);
  - `ADMIN_TOKEN=segredo npm run studio`, com a consola em `/console`;
  - `PORT=3001 npm run runtime`.
- **Convenções** (ver `CLAUDE.md`):
  - ESM e Node 22.13+;
  - tudo em português de Portugal;
  - i18n com PT e EN e as mesmas chaves;
  - regras puras, sem rede, relógio nem `Math.random`;
  - um teste por regra;
  - decisões registadas em `docs/DECISOES.md`.
- **Fluxo:** cada mudança vai num PR pequeno para `main`, com o CI verde. O David funde e o Railway atualiza.
- **Cache no telemóvel:** depois de um deploy, fechar e reabrir a página. O service worker guarda a app e só atualiza nessa altura.
- **Processos no container:** não usar `pkill -f` com um padrão largo, porque mata a própria shell. Procurar o PID com `pgrep -f "^node apps/studio/server.js"` e terminá-lo por PID.
