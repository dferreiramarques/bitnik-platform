// Gerador pseudoaleatório com seed (mulberry32).
// O estado é um único inteiro, por isso cabe no JSON do match e
// permite persistir, fazer replay e reproduzir bugs.

export function seedFrom(input) {
  // Aceita número ou string; devolve um inteiro de 32 bits.
  if (typeof input === 'number' && Number.isFinite(input)) return input >>> 0;
  const s = String(input ?? Date.now());
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(state) {
  let s = state >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    /** Inteiro em [0, n). */
    int: (n) => Math.floor(next() * n),
    /** true com probabilidade p. */
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** Baralha no lugar e devolve o próprio array. */
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    get state() { return s; },
  };
  return rng;
}
