# Nine Oils — histórico de regras

## 1.1.3 — Detalhes da carta (2026-09-28)

Sem mudanças de jogo: cada carta da mão ganha um botão "?" que abre os
detalhes (quando jogar, efeito completo e a frase de sabor), tal como no
jogo online antigo (nineoils.up.railway.app). O texto vem do `REGRAS.md`;
a arte (`ui/cartas/*.png`) ainda não está no pacote — sem ela, o modal
mostra o emoji da carta em grande.

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
- A pausa depois de lançar (para os dois verem os dados) é uma jogada, "Continuar".

Vitórias por lugar em simulação com bots (1000 partidas, quem começa é sorteado): 48,8 / 51,2.

Por fazer: UI própria (por agora usa a UI genérica de protótipo).
