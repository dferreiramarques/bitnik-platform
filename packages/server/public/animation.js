// Animações de imagem (consola › Aparência › Animação): uma imagem carregada
// para um token do skin.json (tipo "image") pode ganhar movimento, e ter
// vários frames. O token guarda o frame 1; os restantes vão em
// appearance.games[id].anims[token] = { name, frames: ['url("…")', …] }.
//
// A mesa não precisa de saber nada: o `watchAnimations` procura, dentro da
// UI do jogo, as <img> cujo src é o frame 1 de um token animado e anima-as.
// Os efeitos (blur, tremer da chama…) estão em app.css (.anim-<nome>); aqui
// só se trocam os frames.
//
// Sem animações configuradas não faz nada (nem sequer pesquisa o DOM).

export const ANIMATIONS = { 'dice-roll': 'Dice Roll', burning: 'Burning' };
export const MAX_FRAMES = 8; // frame 1 (o token) + até 7 extra

const DICE_MS = 450; // igual ao dado do Nine Oils (0,45 s)
const BURN_FRAME_MS = 140;

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** url("x") → x (vazio se não for um url()). */
export const urlOf = (v) => String(v ?? '').trim().match(/^url\(\s*(['"]?)([\s\S]*)\1\s*\)$/)?.[2] ?? '';

/** Frames de um token, por ordem (o do token primeiro); só os que têm imagem. */
export const framesOf = (cfg, token) => [cfg?.tokens?.[token], ...(cfg?.anims?.[token]?.frames || [])].map(urlOf).filter(Boolean);

// Frames que não carregaram (ficheiro estragado): saltam-se, senão o jogo trocava a <img> pelo seu recuo.
const bad = new Set();

/** Anima uma <img>; devolve a função que a pára. */
function run(img, spec) {
  img.classList.add(`anim-${spec.name}`);
  const { frames } = spec;
  const show = (i) => {
    const ok = frames.filter((f, j) => !j || !bad.has(f)); // o frame 1 é o do jogo: fica sempre
    img.src = ok[i % ok.length];
  };
  let timer = null;
  if (frames.length > 1 && !reduced()) {
    let i = 0;
    if (spec.name === 'burning') {
      timer = setInterval(() => show(++i), BURN_FRAME_MS);
    } else {
      // Dice Roll: percorre os frames (pelo menos duas voltas curtas) e assenta no 1.º.
      const steps = Math.max(7, frames.length * 2);
      const every = DICE_MS / steps;
      timer = setInterval(() => {
        i += 1;
        if (i >= steps) { clearInterval(timer); timer = null; show(0); } else show(i);
      }, every);
    }
  }
  return () => {
    clearInterval(timer);
    img.classList.remove(`anim-${spec.name}`);
    show(0);
  };
}

/**
 * Observa a UI de um jogo e anima as imagens configuradas.
 * `getCfg()` devolve { tokens, anims } do jogo (a aparência ao vivo); chama
 * `rescan()` quando a configuração mudar. `stop()` desliga tudo.
 */
export function watchAnimations(root, getCfg) {
  const running = new Map(); // <img> → { base, stop }
  const preloaded = new Set();

  function specs() {
    const cfg = getCfg() || {};
    const by = new Map(); // url do frame 1 → { name, frames }
    for (const [token, a] of Object.entries(cfg.anims || {})) {
      if (!ANIMATIONS[a?.name]) continue;
      const frames = framesOf(cfg, token);
      if (!frames.length) continue;
      for (const f of frames) {
        if (preloaded.has(f)) continue;
        preloaded.add(f); // sem piscar a meio, e a saber quais não carregam
        const im = new Image();
        im.onerror = () => bad.add(f);
        im.src = f;
      }
      by.set(frames[0], { name: a.name, frames });
    }
    return by;
  }

  function scan() {
    const by = specs();
    for (const [img, r] of running) {
      if (img.isConnected && by.has(r.base) && r.name === by.get(r.base).name && r.frames === by.get(r.base).frames.join('|')) continue;
      r.stop();
      running.delete(img);
    }
    if (!by.size) return;
    for (const img of root.querySelectorAll('img')) {
      if (running.has(img)) continue;
      const base = img.dataset.animBase || img.getAttribute('src');
      const spec = by.get(base);
      if (!spec) continue;
      img.dataset.animBase = base;
      running.set(img, { base, name: spec.name, frames: spec.frames.join('|'), stop: run(img, spec) });
    }
  }

  // Só childList: trocar o src dos frames não volta a disparar a pesquisa.
  const mo = new MutationObserver(scan);
  mo.observe(root, { childList: true, subtree: true });
  scan();
  return {
    rescan: scan,
    stop() { mo.disconnect(); for (const r of running.values()) r.stop(); running.clear(); },
  };
}
