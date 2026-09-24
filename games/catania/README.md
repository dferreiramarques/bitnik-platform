# Catania — pacote de jogo

Regras (`rules.js`, `board.js`), bot (`bot.js`), textos PT/EN (`i18n/`) e UI própria (`ui/`), para `@bitnik/engine`. Regras completas em `REGRAS.md`.

## UI

- `ui/index.js`: módulo `mount(el, ctx)` / `update(msg)` que a plataforma monta na área da mesa (ADR-006).
- `ui/catania.css`: estilos, todos dentro de `.cat` e só com tokens `--cat-*`.
- `ui/skin.json`: valores por omissão dos tokens (paleta "Pergaminho do Etna"). A consola pode sobrepor por deploy (ADR-008).
- `ui/sounds.js`: sons gerados com Web Audio.

## Créditos

- Ícones [OpenMoji](https://openmoji.org), licença [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) (`ui/icons.js`).
- Jogo e regras: David Marques, licença CC BY 4.0.
