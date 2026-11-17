// Synthesised sound for SOLMAR HEAT — no audio files, everything is built
// with the Web Audio API at run time: a low engine hum that follows the
// car's speed, gunshots, explosions, pickups, a coin chime, a two-tone
// siren, and a short victory sting. Nothing here touches the network and
// nothing plays until the player has interacted once (browsers require a
// gesture before audio starts), so every call is guarded and silent when
// the context is not ready yet.

export function makeAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let muted = false;
  let unlocked = false;

  /** Create the context on first user gesture; safe to call any time. */
  function ensure() {
    if (unlocked) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      unlocked = true;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch (err) {
      unlocked = false;
    }
  }

  /** A short oscillator blip with an optional pitch slide. */
  function tone(freq, dur, type, vol, slideTo) {
    if (!unlocked || muted || !ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch (err) {
      /* audio is decoration; never break the game for it */
    }
  }

  /** A burst of filtered noise (shots, explosions, skids). */
  function noiseBurst(dur, vol, lowFreq) {
    if (!unlocked || muted || !ctx) return;
    try {
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowFreq || 1200;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch (err) {
      /* ignore */
    }
  }

  /** Play a little melody: notes are [freq, seconds] pairs. */
  function playNotes(notes, type, vol) {
    if (!unlocked || muted || !ctx) return;
    let t = ctx.currentTime;
    for (const [freq, dur] of notes) {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type || 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol || 0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      } catch (err) {
        /* ignore */
      }
      t += dur;
    }
  }

  function shot() {
    noiseBurst(0.12, 0.35, 2600);
    tone(190, 0.08, 'square', 0.12, 70);
  }

  function boom() {
    noiseBurst(0.7, 0.5, 420);
    tone(90, 0.5, 'sine', 0.3, 34);
  }

  function pickup() {
    tone(660, 0.09, 'sine', 0.16);
    tone(990, 0.12, 'sine', 0.14);
  }

  function coin() {
    playNotes([[1318, 0.07], [1760, 0.14]], 'triangle', 0.14);
  }

  function click() {
    tone(520, 0.05, 'square', 0.08);
  }

  function sting() {
    playNotes([[523, 0.16], [659, 0.16], [784, 0.16], [1046, 0.4]], 'triangle', 0.16);
  }

  function fail() {
    playNotes([[392, 0.2], [311, 0.2], [233, 0.4]], 'sawtooth', 0.08);
  }

  /** Continuous engine hum; level 0..1 follows the car's speed. */
  function engine(level) {
    if (!unlocked || muted || !ctx) return;
    try {
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 55;
        engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      const target = level <= 0.02 ? 0 : 0.05 + level * 0.09;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + level * 95, ctx.currentTime, 0.08);
    } catch (err) {
      /* ignore */
    }
  }

  /** Two-tone police siren while wanted >= 2; call with false to stop. */
  function siren(on) {
    if (!unlocked || muted || !ctx) {
      if (sirenOsc) {
        try { sirenOsc.stop(); } catch (err) { /* ignore */ }
        sirenOsc = null;
      }
      return;
    }
    try {
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenGain = ctx.createGain();
        sirenOsc.type = 'triangle';
        sirenOsc.frequency.value = 780;
        sirenGain.gain.value = 0.045;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        let high = true;
        sirenTimer = window.setInterval(() => {
          if (!sirenOsc) return;
          high = !high;
          sirenOsc.frequency.setTargetAtTime(high ? 780 : 580, ctx.currentTime, 0.05);
        }, 420);
      } else if (!on && sirenOsc) {
        window.clearInterval(sirenTimer);
        sirenTimer = null;
        sirenOsc.stop();
        sirenOsc = null;
      }
    } catch (err) {
      /* ignore */
    }
  }

  function setMuted(value) {
    muted = !!value;
    if (master) master.gain.value = muted ? 0 : 0.5;
    if (muted) siren(false);
  }

  function isMuted() {
    return muted;
  }

  return {
    ensure,
    tone,
    shot,
    boom,
    pickup,
    coin,
    click,
    sting,
    fail,
    engine,
    siren,
    setMuted,
    isMuted,
  };
}
