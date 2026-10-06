// All SFX synthesized in real time via Web Audio API — no audio files. [A.18]

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType = "sine",
  gain = 0.2,
) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.onended = () => { osc.disconnect(); g.disconnect(); };
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const audio = {
  unlock() {
    ac();
  },
  repBeep() {
    tone(880, 0, 0.08, "square", 0.12);
  },
  chime() {
    tone(660, 0, 0.12, "sine", 0.15);
    tone(990, 0.08, 0.15, "sine", 0.12);
  },
  levelUp() {
    // ascending 4-note arpeggio + sweep
    [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.25, "triangle", 0.18));
    const c = ac();
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(200, t0);
    osc.frequency.exponentialRampToValueAtTime(2000, t0 + 0.5);
    g.gain.setValueAtTime(0.08, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.55);
  },
  questComplete() {
    // 7-note run
    [523, 587, 659, 784, 880, 988, 1175].forEach((f, i) =>
      tone(f, i * 0.09, 0.2, "triangle", 0.16),
    );
  },
  rankUp() {
    [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.1, 0.3, "sawtooth", 0.14));
  },
  death() {
    // descending 4-note minor + sub-bass
    [440, 349, 262, 196].forEach((f, i) => tone(f, i * 0.35, 0.5, "sawtooth", 0.18));
    tone(55, 0, 2, "sine", 0.25);
  },
  buy() {
    tone(784, 0, 0.08, "square", 0.1);
    tone(1046, 0.06, 0.1, "square", 0.1);
  },
  error() {
    tone(180, 0, 0.2, "sawtooth", 0.14);
  },
  /* ── Gate battle move sounds [Pokémon-style moveset] ── */
  hitThud() {
    tone(110, 0, 0.16, "sine", 0.22);
    tone(55, 0, 0.22, "sine", 0.18);
    tone(220, 0, 0.06, "square", 0.06);
  },
  weakenBlip() {
    [660, 520, 392].forEach((f, i) => tone(f, i * 0.06, 0.12, "triangle", 0.13));
  },
  empowerRise() {
    [523, 699, 880, 1046].forEach((f, i) => tone(f, i * 0.07, 0.2, "sine", 0.13));
  },
  drainWhoosh() {
    const c = ac();
    tone(300, 0, 0.3, "sine", 0.08);
    tone(440, 0.14, 0.34, "triangle", 0.11);
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.32);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.4);
  },
  ultimateImpact() {
    [330, 220, 110].forEach((f, i) => tone(f, i * 0.05, 0.42, "sawtooth", 0.16));
    tone(55, 0, 0.9, "sine", 0.26);
    tone(880, 0, 0.1, "square", 0.08);
  },
  telegraph() {
    const c = ac();
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(120, t0);
    osc.frequency.exponentialRampToValueAtTime(430, t0 + 0.8);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.85);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.9);
  },
  hardenClink() {
    tone(1250, 0, 0.05, "square", 0.1);
    tone(1860, 0.04, 0.09, "square", 0.08);
  },
};

// ---------- Continuous lockdown drone ----------
let droneNodes: { osc: OscillatorNode[]; g: GainNode; noise?: AudioBufferSourceNode } | null = null;

export function startDrone() {
  const c = ac();
  if (!c || droneNodes) return;
  const g = c.createGain();
  g.gain.value = 0.06;
  g.connect(c.destination);

  const osc1 = c.createOscillator();
  osc1.type = "sawtooth";
  osc1.frequency.value = 55;
  const osc2 = c.createOscillator();
  osc2.type = "sawtooth";
  osc2.frequency.value = 55.6; // detune
  // LFO vibrato
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.3;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 4;
  lfo.connect(lfoGain);
  lfoGain.connect(osc1.frequency);
  lfoGain.connect(osc2.frequency);

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 400;

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(g);

  osc1.start();
  osc2.start();
  lfo.start();

  droneNodes = { osc: [osc1, osc2, lfo], g };
}

export function stopDrone() {
  if (!droneNodes) return;
  try {
    droneNodes.osc.forEach((o) => { o.stop(); o.disconnect(); });
    droneNodes.g.disconnect();
  } catch {
    /* noop */
  }
  droneNodes = null;
}

// ---------- Voice rep counting [D.5] ----------
export const voice = {
  supported() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  },
  say(text: string) {
    if (!this.supported()) return;
    try {
      const synthesis = window.speechSynthesis;
      if (synthesis.speaking || synthesis.pending) synthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      const english = synthesis.getVoices().find((candidate) => candidate.lang.startsWith("en"));
      if (english) u.voice = english; // An empty voice list is fine; the browser supplies its default.
      u.rate = 1.1;
      u.pitch = 1.0;
      u.volume = 1.0;
      synthesis.speak(u);
    } catch {
      /* fire-and-forget */
    }
  },
};
