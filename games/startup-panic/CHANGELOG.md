# Startup Panic — histórico de regras

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
