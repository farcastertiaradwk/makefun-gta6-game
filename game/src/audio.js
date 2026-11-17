// Every sound is synthesised with WebAudio: no audio files, no network.
// Engine hum, sirens, gunshots, explosions, pickups and a small bassline
// loop are built from oscillators and filtered noise. The context is born
// on the first user gesture; M toggles mute.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineNodes = null;
  let sirenNodes = null;
  let musicTimer = null;
  let musicStep = 0;

  // A lazy bassline: A minor, one bar of eight steps, looped.
  const BASS_PATTERN = [55, 0, 55, 65.41, 0, 55, 49, 0];

  function makeNoise(seconds) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // One oscillator blip, optionally sliding down in pitch.
  function blip(freq, duration, type, volume, slideTo) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  // One burst of filtered noise.
  function noiseHit(duration, volume, filterFreq) {
    if (!ctx || muted) return;
    const source = ctx.createBufferSource();
    source.buffer = makeNoise(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  function startMusic() {
    if (musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (!ctx || muted) return;
      const freq = BASS_PATTERN[musicStep % BASS_PATTERN.length];
      musicStep += 1;
      if (freq) blip(freq, 0.22, 'triangle', 0.1);
      if (musicStep % 2 === 0) noiseHit(0.03, 0.02, 6000);
    }, 240);
  }

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      startMusic();
      return true;
    } catch {
      return false;
    }
  }

  function setEngine(speed01) {
    if (!ctx) return;
    if (!engineNodes) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      osc.start();
      engineNodes = { osc, gain };
    }
    engineNodes.osc.frequency.setValueAtTime(50 + speed01 * 130, ctx.currentTime);
    engineNodes.gain.gain.setTargetAtTime(muted ? 0 : 0.02 + speed01 * 0.05, ctx.currentTime, 0.1);
  }

  function setSiren(on) {
    if (!ctx) return;
    if (on && !sirenNodes) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 720;
      const gain = ctx.createGain();
      gain.gain.value = 0.035;
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.8;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 230;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();
      sirenNodes = { osc, lfo, gain };
    } else if (!on && sirenNodes) {
      sirenNodes.osc.stop();
      sirenNodes.lfo.stop();
      sirenNodes = null;
    }
  }

  function playNotes(notes, gap, duration, type, volume) {
    notes.forEach((f, i) => window.setTimeout(() => blip(f, duration, type, volume), i * gap));
  }

  return {
    ensure: unlock,
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
    gunshot() { noiseHit(0.12, 0.35, 1800); blip(180, 0.08, 'square', 0.12, 60); },
    explosion() { noiseHit(0.7, 0.5, 500); blip(70, 0.5, 'sine', 0.4, 30); },
    pickup() { blip(660, 0.09, 'sine', 0.15); window.setTimeout(() => blip(990, 0.12, 'sine', 0.15), 80); },
    mission() { playNotes([523, 659, 784, 1047], 110, 0.18, 'triangle', 0.18); },
    fail() { playNotes([392, 330, 262], 140, 0.22, 'triangle', 0.15); },
    hit() { noiseHit(0.06, 0.2, 900); },
    setEngine,
    setSiren,
  };
}
