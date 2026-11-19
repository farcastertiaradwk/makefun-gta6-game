// Synthesized sound, no audio files: a WebAudio engine hum that follows
// the car's speed, gunshots, two-tone sirens, pickup blips and a little
// mission-complete sting. Everything is guarded — headless Chrome has
// no speakers and must never throw.
export function makeAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;
  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      engineOsc.connect(lp);
      lp.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      return true;
    } catch (e) {
      return false;
    }
  }
  function blip(freq, dur, type, vol, slideTo) {
    if (muted || !ensure()) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      g.gain.value = vol || 0.12;
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch (e) { /* headless: stay silent */ }
  }
  function noise(dur, vol) {
    if (muted || !ensure()) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = vol || 0.2;
      src.connect(g);
      g.connect(ctx.destination);
      src.start();
    } catch (e) { /* headless: stay silent */ }
  }
  return {
    unlock() { ensure(); },
    setMuted(m) {
      muted = m;
      if (engineGain) engineGain.gain.value = 0;
    },
    isMuted() { return muted; },
    engine(speed01) {
      if (muted || !ctx || !engineOsc) return;
      try {
        engineOsc.frequency.value = 50 + speed01 * 130;
        engineGain.gain.value = speed01 > 0.02 ? 0.045 + speed01 * 0.05 : 0;
      } catch (e) { /* ignore */ }
    },
    engineStart() { blip(90, 0.25, 'sawtooth', 0.1, 220); },
    shot() { noise(0.12, 0.22); },
    enemyShot() { noise(0.09, 0.1); },
    reload() { blip(520, 0.08, 'square', 0.08); blip(380, 0.08, 'square', 0.08); },
    pickup() { blip(880, 0.12, 'sine', 0.14, 1320); },
    siren(on) {
      if (!ensure() || muted) return;
      try {
        if (on && !this._siren) {
          const o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.value = 700;
          const g = ctx.createGain();
          g.gain.value = 0.03;
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 0.9;
          const lg = ctx.createGain();
          lg.gain.value = 220;
          lfo.connect(lg);
          lg.connect(o.frequency);
          o.connect(g);
          g.connect(ctx.destination);
          o.start();
          lfo.start();
          this._siren = { o, lfo, g };
        } else if (!on && this._siren) {
          this._siren.o.stop();
          this._siren.lfo.stop();
          this._siren = null;
        }
      } catch (e) { /* ignore */ }
    },
    sting() {
      blip(523, 0.14, 'sine', 0.14);
      setTimeout(() => blip(659, 0.14, 'sine', 0.14), 110);
      setTimeout(() => blip(784, 0.24, 'sine', 0.16), 220);
    },
  };
}
