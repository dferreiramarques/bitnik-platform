// Sons do Catania, gerados com Web Audio (sem ficheiros). Portados do catania-v2.

let ac = null;
function ctx() {
  try {
    ac ??= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    return ac;
  } catch { return null; }
}
function play(fn) { const c = ctx(); if (!c) return; try { fn(c, c.currentTime); } catch { /* sem som */ } }

function tone(c, t, { type = 'sine', from, to, gain = 0.2, dur = 0.3, at = 0, lowpass }) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t + at);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + at + dur * 0.6);
  g.gain.setValueAtTime(0, t + at);
  g.gain.linearRampToValueAtTime(gain, t + at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + at + dur);
  let node = o;
  if (lowpass) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass; o.connect(f); node = f; }
  node.connect(g); g.connect(c.destination);
  o.start(t + at); o.stop(t + at + dur + 0.05);
}

function noise(c, t, { dur = 0.15, gain = 0.15, highpass = 1800 }) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const s = c.createBufferSource();
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = highpass;
  g.gain.setValueAtTime(gain, t);
  s.buffer = buf; s.connect(f); f.connect(g); g.connect(c.destination);
  s.start(t);
}

export const sfx = {
  worker: () => play((c, t) => tone(c, t, { from: 180, to: 60, gain: 0.35, dur: 0.18, lowpass: 400 })),
  fire: () => play((c, t) => {
    tone(c, t, { type: 'sawtooth', from: 55, to: 35, gain: 0.3, dur: 0.55, lowpass: 120 });
    noise(c, t, {});
  }),
  endTurn: () => play((c, t) => { tone(c, t, { from: 440, gain: 0.22, dur: 0.55 }); tone(c, t, { from: 330, gain: 0.22, dur: 0.55, at: 0.18 }); }),
  city: () => play((c, t) => { tone(c, t, { type: 'triangle', from: 523, gain: 0.25, dur: 0.7 }); tone(c, t, { type: 'triangle', from: 784, gain: 0.25, dur: 0.7, at: 0.22 }); }),
  discUp: () => play((c, t) => tone(c, t, { from: 660, to: 1046, gain: 0.18, dur: 0.35 })),
};
