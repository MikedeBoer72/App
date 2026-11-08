// Procedural soundscape with the Web Audio API: wind, birds, crickets, water,
// rain, thunder and chimes. No audio files, everything is synthesised.

import type { Season } from './world/seasons';
import type { Weather } from './world/weather';

type Tod = 'morning' | 'day' | 'evening' | 'night';

export interface SoundScene {
  tod: Tod;
  season: Season;
  weather: Weather;
  waterfall: number; // distance in metres
  pond: number;
}

function noiseBuffer(ctx: AudioContext, seconds: number, brown: boolean): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
  }
  return buf;
}

class Soundscape {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private wind!: GainNode;
  private windFilter!: BiquadFilterNode;
  private rain!: GainNode;
  private fall!: GainNode;
  private trickle!: GainNode;
  private white!: AudioBuffer;
  private brown!: AudioBuffer;
  private scene: SoundScene = { tod: 'day', season: 'summer', weather: 'clear', waterfall: Infinity, pond: Infinity };
  private enabled = true;
  private nextBird = 0;
  private nextCricket = 0;

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.3);
  }

  /** Must be called from a user gesture (iOS). Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      try {
        const nav = navigator as Navigator & { audioSession?: { type: string } };
        // Mix with other audio (music, podcasts) and respect the silent switch.
        if (nav.audioSession) nav.audioSession.type = 'ambient';
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
        this.build();
      } catch {
        return;
      }
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  suspend() {
    this.ctx?.suspend().catch(() => {});
  }

  resume() {
    if (this.ctx && this.enabled) this.ctx.resume().catch(() => {});
  }

  private loop(buf: AudioBuffer, ...chain: AudioNode[]) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = Math.random();
    let node: AudioNode = src;
    for (const n of chain) {
      node.connect(n);
      node = n;
    }
    src.start(0, Math.random() * buf.duration);
    return node;
  }

  private build() {
    const ctx = this.ctx!;
    this.white = noiseBuffer(ctx, 4, false);
    this.brown = noiseBuffer(ctx, 6, true);

    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    // a little stereo "air": gentle compression keeps thunder from clipping
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    // Wind
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 420;
    this.wind = ctx.createGain();
    this.wind.gain.value = 0;
    this.loop(this.brown, this.windFilter, this.wind).connect(this.master);

    // Rain: hiss + body
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 700;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 6500;
    this.rain = ctx.createGain();
    this.rain.gain.value = 0;
    this.loop(this.white, hp, lp, this.rain).connect(this.master);

    // Waterfall: broadband rush
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 900;
    wf.Q.value = 0.4;
    this.fall = ctx.createGain();
    this.fall.gain.value = 0;
    this.loop(this.white, wf, this.fall).connect(this.master);

    // Pond trickle: narrow, wobbling band
    const tr = ctx.createBiquadFilter();
    tr.type = 'bandpass';
    tr.frequency.value = 2400;
    tr.Q.value = 3;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.7;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 700;
    lfo.connect(lfoGain).connect(tr.frequency);
    lfo.start();
    this.trickle = ctx.createGain();
    this.trickle.gain.value = 0;
    this.loop(this.white, tr, this.trickle).connect(this.master);

    window.setInterval(() => this.tick(), 200);
  }

  setScene(s: SoundScene) {
    this.scene = s;
  }

  private tick() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const s = this.scene;
    const storm = s.weather === 'storm';

    // wind breathes slowly
    const gust = 0.5 + 0.5 * Math.sin(now * 0.13) * Math.sin(now * 0.041 + 1);
    const windBase = storm ? 0.32 : s.season === 'winter' ? 0.16 : 0.08;
    this.wind.gain.setTargetAtTime(windBase * (0.55 + gust * 0.6), now, 0.8);
    this.windFilter.frequency.setTargetAtTime((storm ? 700 : 380) + gust * 300, now, 0.8);

    this.rain.gain.setTargetAtTime(storm ? 0.22 : 0, now, 1.5);
    const near = (d: number, range: number) => Math.pow(Math.max(0, 1 - d / range), 2);
    this.fall.gain.setTargetAtTime(0.55 * near(s.waterfall, 40), now, 0.4);
    this.trickle.gain.setTargetAtTime(0.06 * near(s.pond, 12), now, 0.4);

    if (storm) return;

    // Birds by day
    const birdRate = { morning: 1.2, day: 4, evening: 9, night: Infinity }[s.tod] * (s.season === 'winter' ? 3 : 1);
    if (now > this.nextBird && birdRate !== Infinity) {
      this.bird();
      this.nextBird = now + birdRate * (0.5 + Math.random());
    }
    // Crickets at dusk and night (not in winter)
    if ((s.tod === 'evening' || s.tod === 'night') && s.season !== 'winter' && now > this.nextCricket) {
      this.cricket(Math.random() * 1.6 - 0.8);
      this.nextCricket = now + 0.35 + Math.random() * 0.5;
    }
  }

  private bird() {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + 0.05;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    const out = ctx.createGain();
    out.gain.value = 0.05 + Math.random() * 0.05;
    out.connect(pan).connect(this.master);
    const base = 2200 + Math.random() * 2600;
    const style = Math.floor(Math.random() * 3);
    const notes = style === 0 ? 2 + Math.floor(Math.random() * 3) : style === 1 ? 5 + Math.floor(Math.random() * 5) : 1;
    let t = t0;
    for (let i = 0; i < notes; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const g = ctx.createGain();
      const dur = style === 1 ? 0.045 + Math.random() * 0.03 : 0.09 + Math.random() * 0.12;
      const f0 = base * (style === 1 ? 1 + (i % 2) * 0.25 : 0.9 + Math.random() * 0.3);
      const f1 = f0 * (style === 2 ? 0.6 : 1.15 + Math.random() * 0.3);
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur + (style === 1 ? 0.03 : 0.06 + Math.random() * 0.1);
    }
  }

  private cricket(panV: number) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + 0.02;
    const osc = ctx.createOscillator();
    osc.frequency.value = 4300 + Math.random() * 400;
    const g = ctx.createGain();
    g.gain.value = 0;
    const pan = ctx.createStereoPanner();
    pan.pan.value = panV;
    osc.connect(g).connect(pan).connect(this.master);
    const pulses = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < pulses; i++) {
      const t = t0 + i * 0.045;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.018, t + 0.008);
      g.gain.linearRampToValueAtTime(0, t + 0.03);
    }
    osc.start(t0);
    osc.stop(t0 + pulses * 0.045 + 0.05);
  }

  /** Rolling thunder; closeness 0 (far rumble) .. 1 (sharp crack). */
  thunder(closeness: number) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const delay = 0.4 + (1 - closeness) * 2.6; // sound travels slower than light
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.brown;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(220 + closeness * 600, t0);
    lp.frequency.exponentialRampToValueAtTime(90, t0 + 4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.5 + closeness * 0.6, t0 + 0.08 + (1 - closeness) * 0.4);
    // a few rumbling swells
    g.gain.setTargetAtTime(0.35, t0 + 0.6, 0.3);
    g.gain.setTargetAtTime(0.5, t0 + 1.4, 0.25);
    g.gain.setTargetAtTime(0.0001, t0 + 2.2, 1.1);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t0, Math.random() * 2);
    src.stop(t0 + 7);
    if (closeness > 0.6) {
      const crack = ctx.createBufferSource();
      crack.buffer = this.white;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1500;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.25, t0);
      cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      crack.connect(hp).connect(cg).connect(this.master);
      crack.start(t0);
      crack.stop(t0 + 0.4);
    }
  }

  /** Soft bell: 'plant' is a single tone, 'win' a rising arpeggio. */
  chime(kind: 'plant' | 'win') {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const notes = kind === 'win' ? [523.25, 659.25, 783.99, 1046.5] : [783.99 + Math.random() * 200];
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.28;
    const fb = ctx.createGain();
    fb.gain.value = 0.3;
    delay.connect(fb).connect(delay);
    const out = ctx.createGain();
    out.gain.value = 0.14;
    out.connect(this.master);
    delay.connect(out);
    notes.forEach((f, i) => {
      const t = ctx.currentTime + 0.02 + i * 0.16;
      for (const [mult, amp] of [[1, 1], [2.76, 0.25], [5.4, 0.08]]) {
        const o = ctx.createOscillator();
        o.frequency.value = f * mult;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(amp, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8 / mult);
        o.connect(g);
        g.connect(out);
        g.connect(delay);
        o.start(t);
        o.stop(t + 2);
      }
    });
  }
}

export const sound = new Soundscape();
