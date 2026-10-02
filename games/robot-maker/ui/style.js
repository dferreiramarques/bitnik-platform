// Robot Maker — estilos da UI própria, no template vanilla (ADR-014): só usa
// tokens --game-* (skin.json = cópia do vanilla). Vai em JS porque a
// verificação da Forge só aceita ficheiros .js, .json e .md.
export default `
.rm {
  --g: var(--game-glass, rgb(20 32 26 / .35));
  --gl: var(--game-glass-line, rgb(255 250 241 / .35));
  --ot: var(--game-on-table, #fffaf1);
  --otm: var(--game-on-table-muted, rgb(255 250 241 / .75));
  --ac: var(--game-on-table-accent, #ffd9c2);
  position: absolute; inset: 0; overflow: hidden; container-type: size;
  color: var(--ot); font-family: var(--game-font-body, Inter, system-ui, sans-serif);
  -webkit-user-select: none; user-select: none;
}
.rm button { font-family: inherit; line-height: 1.25; cursor: pointer; }
.rm button:disabled { cursor: default; }
.rm :focus-visible { outline: 3px solid var(--ac); outline-offset: 2px; }
.rm-glass, .rm-bar, .rm-pill {
  background: var(--g); border: 1px solid var(--gl);
  -webkit-backdrop-filter: blur(var(--game-glass-blur, 8px)); backdrop-filter: blur(var(--game-glass-blur, 8px));
}
.rm-layout {
  position: absolute; left: 0; right: 0; bottom: 0; top: calc(env(safe-area-inset-top, 0px) + 40px); display: grid; grid-template-columns: minmax(0, 1fr);
  grid-auto-rows: auto; align-content: start; row-gap: 10px; overflow-x: hidden; overflow-y: auto;
  padding: 6px max(12px, env(safe-area-inset-right, 0px)) calc(env(safe-area-inset-bottom, 0px) + 10px) max(12px, env(safe-area-inset-left, 0px));
}
.rm-lbl { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--otm); display: flex; align-items: center; gap: 8px; }
.rm-note { font-size: 12px; color: var(--otm); }

/* jogadores */
.rm-players { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
.rm-player { width: 236px; box-sizing: border-box; border-radius: var(--game-radius, 14px); padding: 9px 10px; display: grid; gap: 6px; align-content: start; }
.rm-player.me { border-color: var(--ot); }
.rm-player.active { box-shadow: 0 0 0 2px color-mix(in srgb, var(--ac) 70%, transparent); }
.rm-player.out { opacity: .6; }
.rm-pname { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 12px; letter-spacing: .02em; text-transform: uppercase; min-width: 0; }
.rm-pname span.n { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rm-pname .pts { font-family: var(--game-font-display); font-size: 18px; font-weight: 800; }
.rm-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; box-shadow: 0 0 0 1px rgb(0 0 0 / .35); }
.rm-pstate { font-size: 11px; color: var(--otm); }
.rm-player.active .rm-pstate { color: var(--ac); font-weight: 600; }
.rm-res { display: flex; gap: 8px; flex-wrap: wrap; font-size: 12px; }
.rm-res b { font-family: var(--game-font-display); font-size: 14px; }
.rm-mini { display: flex; gap: 3px; }
.rm-mini i { flex: 1; height: 16px; border-radius: 4px; font-style: normal; font-size: 10px; font-weight: 700; display: grid; place-items: center; box-shadow: inset 0 0 0 1px var(--gl); color: var(--otm); }
.rm-mini i.l1 { background: color-mix(in srgb, var(--ac) 25%, transparent); color: var(--ot); }
.rm-mini i.l2 { background: color-mix(in srgb, var(--ac) 50%, transparent); color: var(--ot); }
.rm-mini i.l3 { background: var(--game-accent, #b8461f); color: var(--game-on-accent, #fff); box-shadow: none; }

@container (max-width: 760px) {
  .rm-players { flex-wrap: nowrap; overflow-x: auto; justify-content: flex-start; scroll-snap-type: x proximity; padding-bottom: 4px; }
  .rm-player { flex: none; width: 186px; scroll-snap-align: start; }
}
/* fichas da ronda */
.rm-chips { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; }
.rm-pill { border-radius: 999px; padding: 3px 12px; font-size: 12px; font-weight: 600; }
.rm-pill.warn { background: var(--game-accent, #b8461f); color: var(--game-on-accent, #fff); border-color: transparent; }
.rm-pill.turn { color: var(--ac); }

/* centro */
.rm-main { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; align-content: start; padding: 2px; }
@container (min-width: 880px) { .rm-main { grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); } }
.rm-col { display: grid; gap: 12px; align-content: start; min-width: 0; }
.rm-section { display: grid; gap: 8px; }
.rm-board { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
.rm-slot {
  text-align: left; border: 1px solid var(--game-line, #d8c7a8); border-left: 5px solid var(--sc, var(--game-accent));
  background: var(--game-panel, #fffaf1); color: var(--game-text, #2b1b12); border-radius: 10px; padding: 8px 10px; display: grid; gap: 2px;
}
.rm-slot b { font-family: var(--game-font-display); font-size: 15px; }
.rm-slot small { color: var(--game-muted, #6b5b4e); font-size: 11px; }
.rm-slot .fx { font-size: 13px; font-weight: 600; }
.rm-slot:not(:disabled):hover { background: var(--game-panel-2, #f3e4cb); }
.rm-slot:disabled { background: var(--game-disabled-bg, #e6dccb); color: var(--game-disabled-text, #8a7d6e); border-color: var(--game-disabled-line, #cfc3ae); }
.rm-slot.busy { outline: 2px dashed var(--game-danger, #b3261e); }
.rm-slot .who { font-size: 11px; font-weight: 700; color: var(--game-danger, #b3261e); }

/* mercado */
.rm-level { display: grid; gap: 6px; }
.rm-lvhead { display: flex; justify-content: space-between; align-items: baseline; }
.rm-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 6px; }
.rm-piece {
  text-align: left; border: 1px solid var(--game-line, #d8c7a8); background: var(--game-panel, #fffaf1); color: var(--game-text, #2b1b12);
  border-radius: 9px; padding: 6px 8px; display: grid; gap: 2px; position: relative; min-width: 0;
}
.rm-piece .nm { font-weight: 700; font-size: 12px; line-height: 1.2; padding-right: 24px; }
.rm-piece .ct { font-size: 11px; color: var(--game-muted, #6b5b4e); }
.rm-piece .pt { font-family: var(--game-font-display); font-weight: 800; font-size: 13px; }
.rm-piece .st { position: absolute; top: 5px; right: 7px; font-size: 11px; font-weight: 700; color: var(--game-muted, #6b5b4e); }
.rm-piece.buy { border-color: var(--game-accent, #b8461f); box-shadow: 0 0 0 2px color-mix(in srgb, var(--game-accent, #b8461f) 40%, transparent); }
.rm-piece.buy:hover { background: var(--game-panel-2, #f3e4cb); }
.rm-piece:disabled { background: var(--game-disabled-bg, #e6dccb); color: var(--game-disabled-text, #8a7d6e); border-color: var(--game-disabled-line, #cfc3ae); }
.rm-piece:disabled .ct, .rm-piece:disabled .st { color: inherit; }
.rm-piece.sold { opacity: .45; }
.rm-cpugrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }

/* circuitos */
.rm-circs { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 6px; }
.rm-circ { border-radius: 9px; padding: 6px 8px; font-size: 12px; display: grid; gap: 1px; }
.rm-circ b { font-size: 12px; }
.rm-circ small { color: var(--otm); font-size: 11px; }
.rm-circ.taken { opacity: .55; text-decoration: line-through; }

/* a minha área */
.rm-mine { display: grid; gap: 6px; }
.rm-mine-head { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; justify-content: center; }
.rm-mine-head b { font-family: var(--game-font-display); font-size: 16px; }
.rm-robot { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
@container (max-width: 640px) { .rm-robot { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.rm-rslot { border-radius: 9px; padding: 5px 7px; min-height: 50px; display: grid; gap: 1px; align-content: start; background: var(--g); border: 1px dashed var(--gl); min-width: 0; }
.rm-rslot.on { background: var(--game-panel, #fffaf1); color: var(--game-text, #2b1b12); border: 1px solid var(--game-line, #d8c7a8); }
.rm-rslot .k { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; opacity: .75; }
.rm-rslot .v { font-size: 12px; font-weight: 700; line-height: 1.15; }
.rm-rslot .p { font-size: 11px; }
.rm-rslot .amp { color: var(--game-accent-strong, #8f3513); font-weight: 800; }

/* barra de ações */
.rm-bar { position: sticky; bottom: 0; z-index: 5; display: flex; justify-content: center; align-items: center; gap: 8px; flex-wrap: wrap; border-radius: var(--game-radius, 14px); padding: 8px 10px; justify-self: center; }
.rm-btn { min-height: 44px; padding: 0 18px; border-radius: 9px; border: 1px solid var(--gl); background: var(--g); color: var(--ot); font-weight: 700; font-size: 14px; }
.rm-btn.primary { background: var(--game-accent, #b8461f); color: var(--game-on-accent, #fff); border-color: transparent; }
.rm-hint { font-size: 13px; color: var(--ot); }

/* picker da Forja */
.rm-modal { position: absolute; inset: 0; display: grid; place-items: center; background: rgb(0 0 0 / .45); z-index: 20; padding: 16px; }
.rm-modal-box { background: var(--game-panel, #fffaf1); color: var(--game-text, #2b1b12); border: 1px solid var(--game-line, #d8c7a8); border-radius: 14px; padding: 16px; max-width: 420px; width: 100%; display: grid; gap: 10px; }
.rm-modal-box h3 { margin: 0; font-family: var(--game-font-display); font-size: 18px; }
.rm-modal-box .rm-cards { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
.rm-modal-box .rm-btn { color: var(--game-text, #2b1b12); background: var(--game-panel-2, #f3e4cb); border-color: var(--game-line, #d8c7a8); }

/* registo */
.rm-log { position: absolute; left: 12px; bottom: 76px; max-width: 320px; font-size: 10px; font-weight: 300; color: var(--otm); }
.rm-log-head { background: none; border: 0; padding: 0; color: var(--otm); }
.rm-log ol { margin: 4px 0 0; padding: 0; list-style: none; max-height: 40vh; overflow: hidden; display: flex; flex-direction: column; gap: 2px; }
@container (max-width: 760px) { .rm-log { display: none; } }
@media (prefers-reduced-motion: reduce) { .rm * { transition: none !important; animation: none !important; } }
`;
