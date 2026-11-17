// Synthesised sound: everything is an oscillator or a noise buffer, so the
// game ships no audio files. The radio is a low, lo-fi loop — a slow bass
// line, a pad, and a hat made of filtered noise — mixed through one gain so
// mute and the music toggle stay simple. All sound starts only after the
// first user gesture; before that the context is suspended.
import { AUDIO } from './config.js';

const VOICES = { sine: 'sine', square: 'square', sawtooth: 'sawtooth', triangle: 'triangle' };

export function makeAudio() {
  const state = {
    muted: false,
    music: true,
    engineLevel: 0,
    sirenLevel: 0,
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    noiseBuffer: null,
    radioTimer: null,
    radioStep: 0,
  };
  let nextRadioAt = 0;

  function buildContext() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    state.ctx = new Ctx();
    state.master = state.ctx.createGain();
    state.master.gain.value = AUDIO.masterVolume;
    state.master.connect(state.ctx.destination);
    state.noiseBuffer = state.ctx.createBuffer(1, state.ctx.sampleRate * 1, state.ctx.sampleRate);
    const data = state.noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    // Engine hum, one sawtooth kept quiet.
    state.engineOsc = state.ctx.createOscillator();
    state.engineOsc.type = 'sawtooth';
    state.engineOsc.frequency.value = 60;
    state.engineGain = state.ctx.createGain();
    state.engineGain.gain.value = 0;
    state.engineOsc.connect(state.engineGain);
    state.engineGain.connect(state.master);
    state.engineOsc.start();
    // Siren wail, one sine above the engine.
    state.sirenOsc = state.ctx.createOscillator();
    state.sirenOsc.type = 'sine';
    state.sirenOsc.frequency.value = 800;
    state.sirenGain = state.ctx.createGain();
    state.sirenGain.gain.value = 0;
    state.sirenOsc.connect(state.sirenGain);
    state.sirenGain.connect(state.master);
    state.sirenOsc.start();
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!state.ctx || state.muted) return;
    const t0 = state.ctx.currentTime;
    const osc = state.ctx.createOscillator();
    osc.type = VOICES[type] || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const gain = state.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(state.master);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  function noiseBurst(dur, vol, cutoff) {
    if (!state.ctx || state.muted) return;
    const t0 = state.ctx.currentTime;
    const src = state.ctx.createBufferSource();
    src.buffer = state.noiseBuffer;
    const filter = state.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = state.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(state.master);
    src.start(t0);
    src.stop(t0 + dur);
  }

  // Radio: 24 steps of 0.24s, about 85 BPM, A minor. Only when the player
  // is in a car and the music toggle is on.
  function playRadioStep() {
    if (!state.ctx || state.muted || !state.music) return;
    const step = state.radioStep % 24;
    const bassNotes = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
    const chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [164.81, 196, 246.94]];
    if (step % 3 === 0) tone(bassNotes[Math.floor(step / 3)], 0.6, 'triangle', 0.14);
    if (step === 0) {
      const chord = chords[Math.floor(state.radioStep / 24) % 4];
      for (const f of chord) tone(f, 2.2, 'sine', 0.04);
    }
    if (step % 2 === 0) noiseBurst(0.03, 0.05, 6000);
    state.radioStep += 1;
  }

  state.unlock = () => {
    if (!state.ctx) buildContext();
    if (state.ctx && state.ctx.state === 'suspended') state.ctx.resume();
    if (state.radioTimer) return;
    state.radioTimer = setInterval(() => {
      if (!state.ctx || state.muted || !state.music) return;
      const now = state.ctx.currentTime;
      if (now >= nextRadioAt) {
        nextRadioAt = now + 0.24;
        playRadioStep();
      }
    }, 100);
  };

  state.setMuted = (muted) => {
    state.muted = muted;
    if (state.master && state.ctx) state.master.gain.value = muted ? 0 : AUDIO.masterVolume;
  };

  state.toggleMusic = () => {
    state.music = !state.music;
    return state.music;
  };

  state.setEngine = (level) => {
    state.engineLevel = level;
    if (state.ctx && state.engineGain && !state.muted) {
      state.engineGain.gain.value = level * 0.06;
      state.engineOsc.frequency.value = 60 + level * 100;
    }
  };

  state.setSiren = (on) => {
    state.sirenLevel = on ? 1 : 0;
    if (state.ctx && state.sirenGain && !state.muted) {
      state.sirenGain.gain.value = on ? 0.035 : 0;
      if (on) state.sirenOsc.frequency.setValueAtTime(800 + Math.sin(state.ctx.currentTime * 4) * 250, state.ctx.currentTime);
    }
  };

  state.gunshot = () => noiseBurst(0.12, 0.4, 3000);
  state.pickup = () => tone(880, 0.12, 'sine', 0.2);
  state.cash = () => {
    tone(1320, 0.08, 'sine', 0.15);
    setTimeout(() => tone(1760, 0.1, 'sine', 0.15), 80);
  };
  state.explosion = () => {
    noiseBurst(0.6, 0.5, 500);
    tone(60, 0.5, 'sine', 0.4, 30);
  };
  state.missionComplete = () => {
    [523.25, 659.25, 783.99].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'sine', 0.2), i * 120));
  };
  state.missionFailed = () => {
    [392, 311.13, 233.08].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sawtooth', 0.12), i * 140));
  };
  state.uiClick = () => tone(660, 0.06, 'sine', 0.12);

  return state;
}
