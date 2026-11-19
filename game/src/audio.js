// Synthesized sound for SOLMAR HEAT: no audio files, everything is built
// from WebAudio oscillators and noise buffers at run time. Engine hum,
// gunshots, sirens, pickups and a little mission-complete sting. M mutes.
// Every call is guarded: with no audio context yet, sounds are skipped.

export function makeAudio() {
  const audio = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    muted: false,
    started: false,
    ensure() {
      if (audio.ctx) return true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        audio.ctx = new AC();
        audio.master = audio.ctx.createGain();
        audio.master.gain.value = audio.muted ? 0 : 0.5;
        audio.master.connect(audio.ctx.destination);
        audio.started = true;
        return true;
      } catch (err) {
        return false;
      }
    },
    resume() {
      if (audio.ctx && audio.ctx.state === 'suspended') {
        audio.ctx.resume().catch(() => {});
      }
    },
    toggleMute() {
      audio.muted = !audio.muted;
      if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
      return audio.muted;
    },
    // A short tone: frequency slide, gain envelope, then stop.
    blip(freqFrom, freqTo, dur, type, vol) {
      if (!audio.ensure()) return;
      try {
        const t = audio.ctx.currentTime;
        const osc = audio.ctx.createOscillator();
        const g = audio.ctx.createGain();
        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freqFrom, t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), t + dur);
        g.gain.setValueAtTime(vol || 0.18, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(g);
        g.connect(audio.master);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      } catch (err) {
        // Sound is cosmetic; never break the game.
      }
    },
    // Filtered noise burst: gunshots, crashes, explosions.
    noise(dur, vol, cutoff) {
      if (!audio.ensure()) return;
      try {
        const t = audio.ctx.currentTime;
        const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
        const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = audio.ctx.createBufferSource();
        src.buffer = buf;
        const filt = audio.ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = cutoff || 1200;
        const g = audio.ctx.createGain();
        g.gain.setValueAtTime(vol || 0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(filt);
        filt.connect(g);
        g.connect(audio.master);
        src.start(t);
      } catch (err) {
        // Sound is cosmetic; never break the game.
      }
    },
    shot() {
      audio.noise(0.12, 0.35, 2600);
    },
    crash() {
      audio.noise(0.25, 0.3, 500);
    },
    boom() {
      audio.noise(0.6, 0.5, 320);
      audio.blip(90, 30, 0.5, 'sine', 0.4);
    },
    pickup() {
      audio.blip(660, 990, 0.12, 'sine', 0.22);
    },
    cash() {
      audio.blip(880, 880, 0.08, 'sine', 0.2);
      setTimeout(() => audio.blip(1320, 1320, 0.1, 'sine', 0.2), 90);
    },
    sting() {
      // Mission complete: three rising notes.
      const notes = [523, 659, 784];
      notes.forEach((f, i) => {
        setTimeout(() => audio.blip(f, f, 0.22, 'triangle', 0.22), i * 130);
      });
    },
    fail() {
      audio.blip(220, 110, 0.5, 'sawtooth', 0.2);
    },
    siren(on) {
      // Two-tone police siren, looped while any heat is on.
      if (!audio.ensure()) return;
      try {
        if (on && !audio.sirenOsc) {
          const osc = audio.ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = 700;
          const g = audio.ctx.createGain();
          g.gain.value = 0.05;
          const lfo = audio.ctx.createOscillator();
          lfo.frequency.value = 0.9;
          const lfoGain = audio.ctx.createGain();
          lfoGain.gain.value = 220;
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          osc.connect(g);
          g.connect(audio.master);
          osc.start();
          lfo.start();
          audio.sirenOsc = osc;
          audio.sirenLfo = lfo;
          audio.sirenGain = g;
        } else if (!on && audio.sirenOsc) {
          audio.sirenOsc.stop();
          audio.sirenLfo.stop();
          audio.sirenOsc = null;
          audio.sirenLfo = null;
          audio.sirenGain = null;
        }
      } catch (err) {
        // Sound is cosmetic; never break the game.
      }
    },
    // Engine hum follows the player's speed; called every frame.
    engine(speed01) {
      if (!audio.ensure()) return;
      try {
        if (!audio.engineOsc) {
          const osc = audio.ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = 60;
          const filt = audio.ctx.createBiquadFilter();
          filt.type = 'lowpass';
          filt.frequency.value = 420;
          const g = audio.ctx.createGain();
          g.gain.value = 0;
          osc.connect(filt);
          filt.connect(g);
          g.connect(audio.master);
          osc.start();
          audio.engineOsc = osc;
          audio.engineGain = g;
        }
        const target = speed01 > 0.03 ? 0.05 + speed01 * 0.06 : 0;
        audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.1);
        audio.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, audio.ctx.currentTime, 0.08);
      } catch (err) {
        // Sound is cosmetic; never break the game.
      }
    },
  };
  return audio;
}
