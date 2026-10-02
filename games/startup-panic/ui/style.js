// Startup Panic — estilos da UI própria, no template vanilla (ADR-014): só usa
// tokens --game-* e --sp-setor-* do skin.json. Vai em JS porque a verificação da
// Forge só aceita ficheiros .js, .json e .md.
export default `
.sp {
  --g: var(--game-glass, rgb(20 32 26 / .35));
  --gl: var(--game-glass-line, rgb(255 250 241 / .35));
  --ot: var(--game-on-table, #fffaf1);
  --otm: var(--game-on-table-muted, rgb(255 250 241 / .75));
  --ac: var(--game-on-table-accent, #ffd9c2);
  --warn: var(--game-on-table-warn, #ffb38f);
  position: absolute; inset: 0; overflow: hidden; container-type: size;
  color: var(--ot); font-family: var(--game-font-body, Inter, system-ui, sans-serif);
  -webkit-user-select: none; user-select: none;
}
.sp button { font-family: inherit; line-height: 1.25; cursor: pointer; }
.sp button:disabled { cursor: default; }
.sp :focus-visible { outline: 3px solid var(--ac); outline-offset: 2px; }
.sp-glass, .sp-bar, .sp-pill {
  background: var(--g); border: 1px solid var(--gl);
  -webkit-backdrop-filter: blur(var(--game-glass-blur, 8px)); backdrop-filter: blur(var(--game-glass-blur, 8px));
}
.sp-layout {
  position: absolute; left: 0; right: 0; bottom: 0; top: calc(env(safe-area-inset-top, 0px) + 40px); display: grid; grid-template-columns: minmax(0, 1fr);
  grid-auto-rows: auto; align-content: start; row-gap: 10px; overflow-x: hidden; overflow-y: auto;
  padding: 6px max(12px, env(safe-area-inset-right, 0px)) calc(env(safe-area-inset-bottom, 0px) + 10px) max(12px, env(safe-area-inset-left, 0px));
}
.sp-lbl { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--otm); display: flex; align-items: center; gap: 8px; }

/* jogadores, pela ordem da ronda */
.sp-players { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
.sp-player { width: 220px; box-sizing: border-box; border-radius: var(--game-radius, 14px); padding: 9px 10px; display: grid; gap: 5px; align-content: start; position: relative; }
.sp-player.me { border-color: var(--ot); }
.sp-player.active { box-shadow: 0 0 0 2px color-mix(in srgb, var(--ac) 70%, transparent); }
.sp-pname { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 12px; letter-spacing: .02em; text-transform: uppercase; min-width: 0; }
.sp-pname .n { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-pos { font-family: var(--game-font-display); font-size: 16px; font-weight: 800; color: var(--ac); min-width: 14px; }
.sp-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; box-shadow: 0 0 0 1px rgb(0 0 0 / .35); }
.sp-pstate { font-size: 11px; color: var(--otm); }
.sp-player.active .sp-pstate { color: var(--ac); font-weight: 600; }
.sp-res { display: flex; gap: 10px; flex-wrap: wrap; font-size: 12px; }
.sp-res b { font-family: var(--game-font-display); font-size: 14px; }
@container (max-width: 760px) {
  .sp-players { flex-wrap: nowrap; overflow-x: auto; justify-content: flex-start; scroll-snap-type: x proximity; padding-bottom: 4px; }
  .sp-player { flex: none; width: 176px; scroll-snap-align: start; }
}

/* timeline das 12 rondas */
.sp-timeline { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 4px; }
.sp-tl { border-radius: 8px; padding: 4px 2px; text-align: center; display: grid; gap: 2px; align-content: start; min-height: 40px; background: var(--g); border: 1px solid var(--gl); color: var(--otm); }
.sp-tl b { font-family: var(--game-font-display); font-size: 14px; }
.sp-tl span { font-size: 10px; font-weight: 700; white-space: nowrap; }
.sp-tl.done { opacity: .55; }
.sp-tl.now { color: var(--ot); border-color: var(--ot); box-shadow: 0 0 0 2px color-mix(in srgb, var(--ac) 70%, transparent); }
.sp-tl.gate { background: color-mix(in srgb, var(--game-accent, #b8461f) 55%, transparent); color: var(--ot); border-color: var(--ac); }
@container (max-width: 520px) { .sp-tl span { font-size: 8px; } .sp-tl b { font-size: 12px; } }

/* CEO, Gate e setores */
.sp-top { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
@container (min-width: 880px) { .sp-top { grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); } }
.sp-ceo { border-radius: var(--game-radius, 14px); padding: 10px 12px; display: grid; gap: 4px; }
.sp-ceo .nm { font-family: var(--game-font-display); font-size: 18px; font-weight: 800; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.sp-ceo .role { font-size: 12px; color: var(--otm); }
.sp-ceo .fx { font-size: 13px; }
.sp-die { display: inline-grid; place-items: center; min-width: 26px; height: 26px; border-radius: 7px; background: var(--ot); color: #1d3350; font-weight: 800; font-size: 15px; }
.sp-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.sp-pill { border-radius: 999px; padding: 3px 12px; font-size: 12px; font-weight: 600; }
.sp-pill.gate { background: var(--game-accent, #b8461f); color: var(--game-on-accent, #fff); border-color: transparent; }
.sp-pill.warn { color: var(--warn); }
.sp-pill.turn { color: var(--ac); }
.sp-sectors { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; align-content: start; }
.sp-sector { border-radius: 9px; padding: 6px 8px; display: grid; gap: 1px; border-left: 4px solid var(--sc); min-width: 0; }
.sp-sector b { font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-sector .v { font-family: var(--game-font-display); font-size: 16px; font-weight: 800; }
.sp-sector .v.up { color: var(--game-on-table-accent, #ffd9c2); }
.sp-sector .v.down { color: var(--warn); }
@container (max-width: 520px) { .sp-sectors { grid-template-columns: repeat(auto-fit, minmax(84px, 1fr)); } }

/* startups */
.sp-section { display: grid; gap: 8px; }
.sp-startups { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
.sp-su {
  border: 1px solid var(--game-line, #d8c7a8); border-top: 5px solid var(--sc); background: var(--game-panel, #fffaf1); color: var(--game-text, #2b1b12);
  border-radius: 10px; padding: 8px 10px; display: grid; gap: 5px; align-content: start; min-width: 0;
}
.sp-su.mine { box-shadow: 0 0 0 2px color-mix(in srgb, var(--game-accent, #b8461f) 45%, transparent); }
.sp-su.dead { background: var(--game-disabled-bg, #e6dccb); color: var(--game-disabled-text, #8a7d6e); border-top-color: var(--game-disabled-line, #cfc3ae); }
.sp-su.dead .nm { text-decoration: line-through; }
.sp-suhead { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
.sp-su .nm { font-family: var(--game-font-display); font-size: 15px; font-weight: 800; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-su .price { font-family: var(--game-font-display); font-size: 20px; font-weight: 800; }
.sp-su small { color: var(--game-muted, #6b5b4e); font-size: 11px; }
.sp-su.dead small { color: inherit; }
.sp-holders { display: flex; gap: 8px; flex-wrap: wrap; font-size: 12px; min-height: 18px; }
.sp-holders span { display: inline-flex; align-items: center; gap: 4px; }
.sp-holders b { font-weight: 800; }
.sp-wk { display: flex; gap: 4px; flex-wrap: wrap; font-size: 12px; min-height: 18px; }
.sp-wk span { background: var(--game-panel-2, #f3e4cb); border-radius: 6px; padding: 0 5px; }
.sp-acts { display: flex; gap: 5px; flex-wrap: wrap; }
.sp-su .sp-acts { flex-wrap: nowrap; gap: 4px; }
.sp-su .sp-act { flex: 1 1 0; min-height: 28px; padding: 0 6px; font-size: 11px; white-space: nowrap; }
.sp-act { min-height: 34px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--game-line, #d8c7a8); background: var(--game-panel-2, #f3e4cb); color: var(--game-text, #2b1b12); font-weight: 700; font-size: 12px; }
.sp-act.buy { border-color: var(--game-accent, #b8461f); }
.sp-act.gate { background: var(--game-accent, #b8461f); color: var(--game-on-accent, #fff); border-color: transparent; }
.sp-act:disabled { background: var(--game-disabled-bg, #e6dccb); color: var(--game-disabled-text, #8a7d6e); border-color: var(--game-disabled-line, #cfc3ae); }

@container (max-width: 520px) { .sp-startups { grid-template-columns: repeat(2, minmax(0, 1fr)); } .sp-su { padding: 7px 8px; } }

.sp-su .price small { font-size: 11px; font-weight: 800; margin-left: 4px; }
.sp-su .price small.up { color: var(--game-accent-strong, #8f3513); }
.sp-su .price small.down { color: var(--game-danger, #b3261e); }
.sp-su .sp-warn { color: var(--game-danger, #b3261e); font-weight: 700; }
.sp-yield { font-family: var(--game-font-display); font-size: 13px; color: var(--game-accent-strong, #8f3513); }
.sp-wk { align-items: center; }
.sp-desc { margin: 0; font-size: 13px; }

/* mini gráfico no cartão da startup */
.sp-mini { display: block; width: 100%; padding: 0; margin: 0; border: 1px solid var(--game-line, #d8c7a8); border-radius: 8px; background: var(--game-panel-2, #f3e4cb); cursor: pointer; overflow: hidden; }
.sp-mini svg { display: block; width: 100%; height: 44px; }
.sp-mini:hover { border-color: var(--game-accent, #b8461f); }
.sp-su.dead .sp-mini { opacity: .6; }

/* gráfico de velas */
.sp-nm { background: none; border: 0; padding: 0; color: inherit; text-align: left; font-family: var(--game-font-display); font-size: 15px; font-weight: 800; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.sp-nm:hover { text-decoration: underline; }
.sp-chartbox { max-width: 720px; }
.sp-chart { width: 100%; height: auto; display: block; border-radius: 10px; }
.sp-chartbg { fill: var(--game-panel, #fffaf1); }
.sp-grid { stroke: var(--game-line, #d8c7a8); stroke-width: 1; }
.sp-axis { fill: var(--game-muted, #6b5b4e); font-size: 11px; font-family: var(--game-font-body, Inter, system-ui, sans-serif); }
.sp-axisx.now { fill: var(--game-text, #2b1b12); font-weight: 800; }
.sp-gatebg { fill: var(--game-accent, #b8461f); opacity: .12; }
.sp-candle line { stroke-width: 2; }
.sp-candle.up line, .sp-candle.up rect { stroke: var(--sp-up, #2e9e4f); fill: var(--sp-up, #2e9e4f); }
.sp-candle.down line, .sp-candle.down rect { stroke: var(--sp-down, #d1242f); fill: var(--sp-down, #d1242f); }
.sp-candle.flat line, .sp-candle.flat rect { stroke: var(--game-muted, #6b5b4e); fill: var(--game-muted, #6b5b4e); }

/* a minha equipa */
.sp-team { display: grid; gap: 6px; }
.sp-teamhead { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; justify-content: center; }
.sp-teamhead b { font-family: var(--game-font-display); font-size: 16px; }
.sp-workers { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 6px; }
.sp-worker { border-radius: 9px; padding: 6px 8px; display: grid; gap: 4px; background: var(--game-panel, #fffaf1); color: var(--game-text, #2b1b12); border: 1px solid var(--game-line, #d8c7a8); }
.sp-worker .nm { font-weight: 700; font-size: 13px; }
.sp-worker small { color: var(--game-muted, #6b5b4e); font-size: 11px; }
.sp-empty { text-align: center; font-size: 13px; color: var(--otm); }

/* barra de ações */
.sp-bar { position: sticky; bottom: 0; z-index: 5; display: flex; justify-content: center; align-items: center; gap: 8px; flex-wrap: wrap; border-radius: var(--game-radius, 14px); padding: 8px 10px; justify-self: center; }
.sp-btn { min-height: 44px; padding: 0 18px; border-radius: 9px; border: 1px solid var(--gl); background: var(--g); color: var(--ot); font-weight: 700; font-size: 14px; }
.sp-btn.primary { background: var(--game-accent, #b8461f); color: var(--game-on-accent, #fff); border-color: transparent; }
.sp-hint { font-size: 13px; color: var(--ot); }

/* janelas */
.sp-modal { position: absolute; inset: 0; display: grid; place-items: center; background: rgb(0 0 0 / .45); z-index: 20; padding: 16px; }
.sp-modal-box { background: var(--game-panel, #fffaf1); color: var(--game-text, #2b1b12); border: 1px solid var(--game-line, #d8c7a8); border-radius: 14px; padding: 16px; max-width: 440px; width: 100%; display: grid; gap: 10px; max-height: 100%; overflow-y: auto; }
.sp-modal-box h3 { margin: 0; font-family: var(--game-font-display); font-size: 18px; }
.sp-modal-box .sp-lbl { color: var(--game-muted, #6b5b4e); }
.sp-opts { display: flex; gap: 6px; flex-wrap: wrap; }
.sp-opt { min-height: 40px; padding: 0 12px; border-radius: 9px; border: 1px solid var(--game-line, #d8c7a8); background: var(--game-panel-2, #f3e4cb); color: var(--game-text, #2b1b12); font-weight: 700; font-size: 13px; }
.sp-opt.on { background: var(--game-accent, #b8461f); color: var(--game-on-accent, #fff); border-color: transparent; }
.sp-opt:disabled { background: var(--game-disabled-bg, #e6dccb); color: var(--game-disabled-text, #8a7d6e); }
.sp-modal-box .sp-btn { color: var(--game-text, #2b1b12); background: var(--game-panel-2, #f3e4cb); border-color: var(--game-line, #d8c7a8); }
.sp-modal-box .sp-btn.primary { background: var(--game-accent, #b8461f); color: var(--game-on-accent, #fff); border-color: transparent; }
.sp-modal-box .sp-btn:disabled { background: var(--game-disabled-bg, #e6dccb); color: var(--game-disabled-text, #8a7d6e); }
.sp-modal-acts { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }

/* tutorial */
.sp-guide {
  position: absolute; z-index: 25; left: 12px; right: 12px; top: 48px; box-sizing: border-box; padding: 12px 14px; display: grid; gap: 6px; max-height: 45%; overflow-y: auto;
  background: var(--game-panel, #fffaf1); color: var(--game-text, #2b1b12); border: 2px solid var(--game-accent, #b8461f); border-radius: var(--game-radius, 14px);
  box-shadow: 0 12px 32px rgb(0 0 0 / .35); font-family: var(--game-font-body, Inter, system-ui, sans-serif);
}
/* Com o tutorial a decorrer, a mesa deixa espaço ao guia: em baixo dele (ecrã estreito) ou ao lado (ecrã largo). */
.tutorial .sp-layout { top: calc(env(safe-area-inset-top, 0px) + 56px + var(--sp-guide-h, 180px)); }
@media (min-width: 1100px) {
  .sp-guide { left: auto; right: 12px; width: 340px; max-height: calc(100% - 60px); }
  .tutorial .sp-layout { top: calc(env(safe-area-inset-top, 0px) + 40px); right: 364px; }
}
.sp-guide h3 { font-family: var(--game-font-display); color: var(--game-accent-strong, #8f3513); margin: 0; font-size: 17px; }
.sp-guide p { margin: 0; line-height: 1.5; font-size: 14px; }
.sp-guide-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--game-muted, #6b5b4e); }
.sp-guide-btns { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
.sp-guide .sp-btn { min-height: 36px; padding: 4px 12px; font-size: 13px; color: var(--game-text, #2b1b12); background: var(--game-panel-2, #f3e4cb); border-color: var(--game-line, #d8c7a8); }
.sp-guide .sp-btn.primary { background: var(--game-accent, #b8461f); color: var(--game-on-accent, #fff); border-color: transparent; }
.tut-hi { outline: 3px solid var(--game-on-table-accent, #ffd9c2); outline-offset: 3px; border-radius: 10px; animation: sp-pulse 1.6s ease-in-out infinite; }
@keyframes sp-pulse { 50% { outline-color: transparent; } }
@media (prefers-reduced-motion: reduce) { .tut-hi { animation: none; } }

/* registo */
.sp-log { position: absolute; left: 12px; bottom: 76px; max-width: 320px; font-size: 10px; font-weight: 300; color: var(--otm); }
.sp-log-head { background: none; border: 0; padding: 0; color: var(--otm); }
.sp-log ol { margin: 4px 0 0; padding: 0; list-style: none; max-height: 40vh; overflow: hidden; display: flex; flex-direction: column; gap: 2px; }
@container (max-width: 760px) { .sp-log { display: none; } }
@media (prefers-reduced-motion: reduce) { .sp * { transition: none !important; animation: none !important; } }
`;
