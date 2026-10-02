// Movimento da plataforma: entradas e saídas curtas e calmas (fade com uma
// subida de poucos píxeis), para nada aparecer ou desaparecer aos saltos.
// A duração e a curva vêm dos tokens --motion-fast / --motion-ease (skin).
//
//   .fx-in   (app.css)  entra: o JS só a põe na renderização que abre,
//                       para um redesenho a seguir não repetir a animação
//   .fx-out  (app.css)  sai: o JS espera `afterLeave` antes de tirar do DOM

const FALLBACK_MS = 160;

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Duração do movimento em ms (o token --ui-motion; 160 se não estiver definido). */
export function motionMs() {
  if (typeof getComputedStyle !== 'function') return FALLBACK_MS;
  const v = getComputedStyle(document.documentElement).getPropertyValue('--ui-motion').trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return FALLBACK_MS;
  return /ms$/.test(v) ? n : n * 1000;
}

/** Corre `done` quando a saída acaba (de imediato com movimento reduzido). Um tempo limite, não `animationend`: nunca fica preso. */
export function afterLeave(done) {
  if (reducedMotion()) { done(); return; }
  setTimeout(done, motionMs() + 20);
}

/** Aviso passageiro (toast) com fade: aparece, fica `ms` e esmorece. */
export function flash(el, text, ms = 3200) {
  clearTimeout(flash.hold);
  clearTimeout(flash.gone);
  el.textContent = text;
  el.hidden = false;
  el.classList.remove('fx-out', 'fx-in');
  void el.offsetWidth; // recomeça a animação se já estava à vista
  el.classList.add('fx-in');
  flash.hold = setTimeout(() => {
    el.classList.replace('fx-in', 'fx-out');
    afterLeave(() => { el.hidden = true; el.classList.remove('fx-out'); });
  }, ms);
}
