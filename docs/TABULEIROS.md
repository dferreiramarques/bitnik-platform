# Tabuleiros

> Estado: proposta validada em conversa, para implementar depois da Fase 1 (o editor depende dos cartões do Forge).
> Acrescentar ao `docs/CONTRATO.md` como secção nova.

## 1. Princípios

- **As regras nunca leem a arte.** O PNG é skin. Tudo o que as regras usam (localizações, ligações, custos, características) compila para dados.
- **Um modelo comum.** Todos os tipos de tabuleiro, exceto a mesa, reduzem-se a localizações (nós) e ligações (arestas). O tipo é um *preset* que decide o editor no Studio, os helpers do motor disponíveis e o comportamento da UI.
- **Componentes habitam o tabuleiro.** Um componente definido no Forge (peça, marcador, recurso) pode ocupar uma localização, disparar ações e ter o seu próprio estado — ver secção 4.
- **Ids imutáveis.** O nome visível de uma localização pode mudar; o id não. Cartões, testes e partidas guardadas referem-se ao id.
- **Tabuleiro versionado com o pacote.** O que o publisher aprova inclui aquela versão exata do tabuleiro, tal como as regras.
- **Custos resolvidos na compilação.** Distâncias calculadas por componente são convertidas em números finais no build. O pacote entregue só leva valores fixos: regras determinísticas, simulação rápida, replay exato.
- **Editor no Studio.** Os tabuleiros e os componentes são criados nos editores do Studio, não importados de ferramentas externas, para o formato e a ferramenta evoluírem e serem testados juntos.

## 2. Tipos de tabuleiro

O tipo escolhe-se ao definir o jogo no Studio.

| # | Tipo | Modelo | Zoom e pan | Exemplos |
|---|------|--------|------------|----------|
| 1 | Mesa | Só zonas (mãos, baralhos, descarte, área central), sem topologia | Não | Capivaras, Nine Oils |
| 2 | Grelha | Grafo gerado a partir de linhas × colunas; quadrados ou hexágonos, sempre regular | Sim | Xadrez, mapa de dungeon |
| 3 | Relativo | Grafo que cresce em jogo: uma peça inicial, as seguintes encaixam adjacentes | Sim | Colocação de peças |
| 4 | Arena | Poucas áreas grandes com modificadores de jogo, jogador e pontuação; componentes jogados afetam as áreas | Sim | Estilo Risco |
| 5 | Puzzle | Peças geométricas encaixadas pelo jogador; pontuação por padrões (combos) | A definir | Tabuleiro pessoal de encaixe |
| 6 | Táctico | Percursos e localizações com estado, buffs, slots de material, interação, custo de distância e zonas | Sim | — |

### Encaixes do tipo Relativo

Só encaixes regulares. Formas permitidas:

- Sozinhas: triângulos, quadrados, retângulos, losangos, hexágonos.
- Combinada: octógonos só com quadrados (padrão 4.8.8), porque sozinhos não cobrem o plano.

Pentágonos ficam excluídos. O editor declara as formas do jogo e o motor rejeita encaixes fora do padrão escolhido.

## 3. Formato comum

O ficheiro de tabuleiro vive no pacote do jogo. `boards` é sempre uma lista, para suportar vários tabuleiros no futuro (ver secção 6).

```json
{
  "boards": [
    {
      "id": "mapa",
      "type": "tactico",
      "owner": "shared",
      "art": "skin/mapa.png",
      "nodes": {
        "porto": { "label": "Porto", "x": 0.21, "y": 0.34, "tags": ["cidade"], "card": "LOC-porto" },
        "ponte": { "label": "Ponte", "x": 0.30, "y": 0.41, "tags": ["passagem"] }
      },
      "edges": [
        { "from": "porto", "to": "ponte", "type": "estrada", "cost": 2 },
        { "from": "ponte", "to": "vila", "type": "rio", "cost": { "component": "comprimento", "escala": 10 }, "path": [[0.33, 0.44], [0.36, 0.47]] }
      ],
      "zones": { "norte": ["porto", "ponte"] },
      "pieces": [
        { "id": "guarda-1", "component": "guarda", "at": { "node": "porto" }, "owner": 0 }
      ]
    }
  ]
}
```

- `x`, `y`: coordenadas normalizadas (0 a 1), independentes da resolução da imagem.
- `cost`: número fixo ou referência a um componente. No pacote compilado é sempre número.
- `path`: pontos intermédios opcionais, só para a UI animar o movimento pelo traçado.
- `card`: cartão de lógica do Forge com as características e ações da localização.
- `pieces`: a colocação inicial de componentes no tabuleiro (o `setup` das regras pode acrescentar mais em jogo) — ver secção 4.

## 4. Componentes no tabuleiro

Um componente definido no Forge (peça, marcador, recurso) pode ser colocado no tabuleiro, ocupar uma localização e ter o seu próprio estado, independente do estado da localização em si.

- **Ocupação.** Cada componente colocado (`pieces[]`) referencia o seu tipo (`component`, um cartão do Forge) e onde está (`at`). É a localização, não o componente, que sabe o que ocupa cada slot dela (`view` já reflete isto sem um conceito novo).
- **Modo de colocação — só `snap` por agora.** `at: { node: "<id>" }` prende o componente a uma localização (ou a uma zona, para peças que não ficam num nó exato). É o único modo implementado nesta iteração.
  - **Adiado:** `at: { x, y }` livre, com colisão para detetar sobreposição e ativar uma localização por proximidade em vez de por id. Fica para depois de haver um tipo de tabuleiro que precise mesmo disso (Arena, Puzzle) — implica física contínua (deteção de colisão em tempo real), um paradigma diferente do grafo discreto que o resto do modelo usa. Ver secção 7.
- **Ações.** Um componente reage a eventos da sua própria localização (entrar, sair, ser ativado) através de `moves`/`events` definidos no SEU cartão Forge, não no ficheiro do tabuleiro — o tabuleiro só diz onde as coisas estão, nunca o que fazem (mantém o princípio 1: as regras vêm de dados, o tabuleiro é só a topologia).
- **Estado.** Dono, contagem, buffs com duração — vive no `state` das regras, como qualquer outro dado do jogo; o tabuleiro só guarda a posição inicial (`pieces[]`), as regras tratam o resto a partir daí.
- **Arrastar na UI.** A UI própria de um jogo já pode fazer um componente arrastável e só confirmar a jogada ao largar sobre um nó válido (padrão já usado nas UIs de tabuleiro existentes, ex. Praia das Percebes); isto é comportamento de UI, não do formato do tabuleiro em si.

## 5. Tipo Táctico

Além do que a secção 4 já cobre para qualquer tipo de tabuleiro, o Táctico acrescenta:

- **Zona:** agrupamento de localizações para regras de área.
- **Pathfinding:** o movimento é sobre o grafo, com os custos das arestas. A visibilidade (nevoeiro de guerra) resolve-se no `view(state, seat)` existente.

**Ciclo de dia e noite:** pertence ao FLOW, não ao tabuleiro. É estado global que ativa ou desativa modificadores nas localizações, por isso fica disponível para qualquer tipo de tabuleiro.

## 6. Editores no Studio

Além do editor de Aparência que já existe, faltam dois:

### 6.1 Editor de Componentes

- Definir a forma e o tamanho de um componente (para a colocação `snap` e, mais tarde, para a colisão do modo livre).
- Ligar o cartão Forge que dá ao componente as suas ações e estado.
- Arte do componente pela convenção de componentes reutilizáveis já existente (`--token-<nome>`, CONTRATO.md).

### 6.2 Editor de Tabuleiro (mesa de jogo) — primeiro corte

- Carregar o PNG como fundo, com escala e zoom.
- Colocar localizações com um clique (id, nome, tags).
- Desenhar trajetórias entre dois nós (tipo, custo fixo ou componente, pontos intermédios).
- Colocar componentes (`pieces[]`) nas localizações, a partir dos definidos no Editor de Componentes.
- Abrir o cartão Forge da localização (ou de um componente) a partir do nó.
- Validação em tempo real: nós isolados, trajetórias órfãs, localizações sem cartão.
- Modo de teste: escolher um nó e ver os destinos alcançáveis com N pontos de movimento.
- Modo de realinhamento: ajustar os nós quando o PNG é substituído por nova arte.

O Studio gera testes automáticos por tabuleiro: grafo ligado, arestas só entre nós existentes, todas as localizações com cartão.

## 7. Fora do âmbito desta iteração

- **Vários tabuleiros por jogo** (tabuleiro do jogador, tabuleiros de objetivos). O formato já os contempla (`boards` é lista, `owner` pode ser `shared` ou por jogador), mas esta iteração implementa um tabuleiro partilhado por jogo, além da mesa.
- **Colocação livre com colisão** (secção 4). Só `snap` a uma localização por agora; livre fica para quando um jogo concreto precisar (Arena ou Puzzle são os candidatos naturais).

## 8. Decisões em aberto

1. **Jogadas legais no contrato.** Acrescentar `legal(state, seat)` para a UI destacar destinos e o bot/simulador enumerar jogadas. É uma mudança de versão major.
2. **Movimento em passos ou atómico.** Passos permitem interceção a meio do percurso; afetam timers e replay.
3. **Regras espaciais no motor.** Quais entram no motor (adjacência, alcance, linha de visão, zonas de controlo, empilhamento) e quais ficam em cada jogo.
4. **Cache de distâncias** para a simulação em massa.
5. **Vocabulário espacial nos cartões Gherkin** ("dado que a unidade está em porto…").
6. **Ordem de implementação dos tipos** e jogo de validação para o Táctico.
7. **Colocação livre com colisão**, quando deixar de estar adiada: que motor de colisão (AABB simples? círculos?), e como isso interage com o pathfinding do Táctico, que assume um grafo discreto.
8. **Formato do componente no Forge**: um cartão novo (tipo "componente"), ou uma extensão do cartão de localização existente.
