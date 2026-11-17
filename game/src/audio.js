// Sound, synthesized with Web Audio only — no audio files, no network. Every
// effect is a short oscillator/noise burst built at call time, so nothing is
// loaded and nothing allocates until it is played. The context is created on
// the first user gesture (browsers block audio before that); until then every
// call is a silent no-op.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let hum = null;

  /** Create (or resume) the context. Call from a click or keypress. */
  function unlock() {
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      context = new AudioContext();
      master = context.createGain();
      // Respect a mute pressed before the context existed.
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      startHum();
    }
    if (context.state === 'suspended') context.resume();
  }

  /** A very soft low drone under the game, so the dark is not silent. */
  function startHum() {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sine';
    osc.frequency.value = 55;
    gain.gain.value = 0.035;
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.frequency.value = 0.11;
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    lfo.start();
    hum = { osc, lfo, gain };
  }

  function tone({ type = 'sine', from = 440, to = null, duration = 0.12, volume = 0.2, delay = 0 }) {
    if (!context || muted) return;
    const now = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function noise({ duration = 0.08, volume = 0.15, lowpass = 1200, delay = 0 }) {
    if (!context || muted) return;
    const now = context.currentTime + delay;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  return {
    unlock,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    /** Short bright blip, pitch falling — the lantern's shot. */
    shoot() { tone({ type: 'square', from: 720, to: 320, duration: 0.07, volume: 0.1 }); },
    /** A bullet landing on a shadow. */
    hit() { noise({ duration: 0.05, volume: 0.12, lowpass: 2400 }); },
    /** A shadow popping: a falling tone plus a soft burst. */
    die() {
      tone({ type: 'sawtooth', from: 320, to: 70, duration: 0.22, volume: 0.16 });
      noise({ duration: 0.14, volume: 0.1, lowpass: 900 });
    },
    /** An ember collected: a bright rising ping. */
    pickup() { tone({ type: 'sine', from: 880, to: 1320, duration: 0.09, volume: 0.12 }); },
    /** The player is hurt: a low thud. */
    hurt() {
      tone({ type: 'sine', from: 140, to: 55, duration: 0.22, volume: 0.3 });
      noise({ duration: 0.12, volume: 0.14, lowpass: 500 });
    },
    /** The lantern is struck: a deep bell. */
    lanternHit() { tone({ type: 'triangle', from: 220, to: 110, duration: 0.4, volume: 0.25 }); },
    /** A wave begins: a short low horn. */
    wave() {
      tone({ type: 'sawtooth', from: 98, to: 98, duration: 0.35, volume: 0.14 });
      tone({ type: 'sawtooth', from: 147, to: 147, duration: 0.35, volume: 0.1, delay: 0.02 });
    },
    /** An upgrade bought: a rising three-note chime. */
    upgrade() {
      tone({ type: 'sine', from: 523, duration: 0.1, volume: 0.16 });
      tone({ type: 'sine', from: 659, duration: 0.1, volume: 0.16, delay: 0.07 });
      tone({ type: 'sine', from: 784, duration: 0.16, volume: 0.18, delay: 0.14 });
    },
    /** The light goes out: slow falling notes. */
    gameOver() {
      tone({ type: 'triangle', from: 392, to: 392, duration: 0.3, volume: 0.2 });
      tone({ type: 'triangle', from: 311, to: 311, duration: 0.3, volume: 0.2, delay: 0.25 });
      tone({ type: 'triangle', from: 233, to: 180, duration: 0.55, volume: 0.22, delay: 0.5 });
    },
  };
}
