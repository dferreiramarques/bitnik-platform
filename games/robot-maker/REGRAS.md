# Robot Maker — regras

## Robot Maker: resumo

Jogo de tabuleiro digital por turnos, worker placement com construção de robot. 2 a 4 jogadores, 45 a 90 minutos, 8+. Projeto educativo InGaming, CICF Maia (STEM). Cada jogador é um engenheiro que constrói o robot mais eficiente. O jogo acaba quando alguém completa o robot e ganha quem tiver mais pontos.

## Valores confirmados pelo David

Fonte: github.com/dferreiramarques/robot-maker (public/index.html, v0.2), com estas decisões do David:
- Início: 0 Bloco L1 e 1 worker.
- Turno: um jogador faz tudo o que consegue (um worker por ação) e depois joga o seguinte; a ronda é um turno de cada jogador.
- Stock 8/2/1 por peça (nível 1 duplicado: as L1 nunca devem escassear) (cada slot e nível, CPUs incluídas), com 4 peças reveladas por nível (3 baralhos baralhados, fila de 4).
- Rotação do mercado: se ninguém adquire peças de um nível numa ronda, a mais à esquerda vai para o fundo e entra a seguinte.
- Circuitos: máximo 1 por jogador; esgotam-se para todos; o worker fica disponível já.
- Gatilho: 6 slots com pelo menos 1 peça L3 e 3 peças de nível 2 ou mais (1×L3, 2×L2, 3×L1).
- Fim de jogo: quem completa o robot (gatilho) não joga mais; a ronda em curso acaba e joga-se mais uma ronda só com os outros (risco/recompensa; impacto a avaliar).
- Progressão: L1 em slot vazio, L2 sobre L1, L3 sobre L2; a Forja só dá L1 em slot vazio, nunca CPUs; a peça substituída sai do jogo; a CPU pode mudar de família respeitando o nível.
- Arredondamentos: para baixo.
- Deploy: +6, a ajustar com testes. Com +7 uma estratégia só de Deploy ganhava a todas as partidas simuladas, por isso fica em 6; se for um caminho de vitória, baixa-se.
- A pontuação é provisória: só se faz commit no fim, como no Catania.
Propostas minhas, a testar: limite de segurança de 30 rondas e desempate por mais peças L3.
