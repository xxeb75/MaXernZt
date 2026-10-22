// Piste son : décodage, analyse du rythme (traitement du signal, sans modèle d'IA) et lecture.
// L'analyse sépare les graves (grosse caisse) des aigus (caisse claire, charleston), cherche les pics de l'enveloppe,
// estime le tempo par autocorrélation puis cale une grille de temps réguliers sur les attaques.

let ctx: AudioContext | null = null;
export const audioCtx = () => (ctx ??= new AudioContext({ sampleRate: 48000 }));   // 48 kHz : accepté par tous les codecs d'export (AAC, Opus)
export async function decodeAudio(bytes: ArrayBuffer): Promise<AudioBuffer> { return audioCtx().decodeAudioData(bytes.slice(0)); }

export interface Analysis {
  bpm: number;
  beats: number[];   // grille régulière de temps (s)
  kicks: number[];   // pics de grosse caisse (graves)
  hits: number[];    // toutes les attaques marquées (graves + aigus)
  flux: Float32Array; hop: number; ref: number;   // courbe d'attaque (pour mesurer la force d'un coup)
}

/** Force d'une attaque à l'instant t, de 0 (faible) à 1 (aussi fort que les plus gros coups du morceau). */
export function strengthAt(a: Analysis, t: number): number {
  if (!a.flux.length || a.ref <= 0) return 0.5;
  const c = Math.round(t / a.hop); let m = 0;
  for (let i = Math.max(0, c - 3); i <= Math.min(a.flux.length - 1, c + 5); i++) if (a.flux[i] > m) m = a.flux[i];
  return Math.min(1, m / a.ref);
}

/** Pics d'une courbe d'attaque : au-dessus de la moyenne locale (± 1 s) + k écarts-types, espacés d'au moins `minGap` s. */
function pickPeaks(f: Float32Array, hop: number, k: number, minGap: number): number[] {
  const n = f.length, W = Math.max(4, Math.round(1 / hop));
  let top = 0; for (let i = 0; i < n; i++) if (f[i] > top) top = f[i];
  if (top <= 0) return [];
  const s1 = new Float64Array(n + 1), s2 = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) { s1[i + 1] = s1[i] + f[i]; s2[i + 1] = s2[i] + f[i] * f[i]; }
  const out: { i: number; v: number }[] = [], gap = Math.max(1, Math.round(minGap / hop));
  for (let i = 1; i < n - 1; i++) {
    if (f[i] < 0.12 * top || f[i] < f[i - 1] || f[i] < f[i + 1]) continue;
    const lo = Math.max(0, i - W), hi = Math.min(n, i + W), c = hi - lo, m = (s1[hi] - s1[lo]) / c, sd = Math.sqrt(Math.max(0, (s2[hi] - s2[lo]) / c - m * m));
    if (f[i] <= m + k * sd) continue;
    const last = out[out.length - 1];
    if (last && i - last.i < gap) { if (f[i] > last.v) { last.i = i; last.v = f[i]; } } else out.push({ i, v: f[i] });
  }
  return out.map(p => p.i * hop);
}

/** sens : 0 (peu de pics, seulement les plus nets) à 1 (beaucoup de pics). */
export function analyse(buf: AudioBuffer, sens = 0.5): Analysis {
  const sr = buf.sampleRate, n = buf.length, ch = buf.numberOfChannels;
  const hop = Math.max(64, Math.round(sr * 0.0116)), hopSec = hop / sr, frames = Math.floor(n / hop);
  if (frames < 8) return { bpm: 0, beats: [], kicks: [], hits: [], flux: new Float32Array(0), hop: hopSec, ref: 0 };
  const mono = new Float32Array(n);
  for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) mono[i] += d[i] / ch; }
  const aLow = 1 - Math.exp((-2 * Math.PI * 150) / sr), aHi = 1 - Math.exp((-2 * Math.PI * 2500) / sr);
  let l1 = 0, l2 = 0, h1 = 0;
  const eLow = new Float32Array(frames), eHigh = new Float32Array(frames), eAll = new Float32Array(frames);
  for (let i = 0, f = 0, c = 0; i < frames * hop; i++) {
    const x = mono[i]; l1 += aLow * (x - l1); l2 += aLow * (l1 - l2); h1 += aHi * (x - h1);
    const hp = x - h1; eLow[f] += l2 * l2; eHigh[f] += hp * hp; eAll[f] += x * x;
    if (++c === hop) { c = 0; f++; }
  }
  // courbe d'attaque : montée (positive) de l'énergie en échelle logarithmique
  const flux = (e: Float32Array) => {
    const v = new Float32Array(frames), d = new Float32Array(frames);
    for (let i = 0; i < frames; i++) v[i] = Math.log(1 + 300 * Math.sqrt(e[i] / hop));
    for (let i = 1; i < frames; i++) d[i] = Math.max(0, v[i] - v[i - 1]);
    for (let i = frames - 1; i > 0; i--) d[i] = 0.65 * d[i] + 0.35 * d[i - 1];   // léger lissage
    return d;
  };
  const fLow = flux(eLow), fHigh = flux(eHigh), fFull = flux(eAll), fAll = new Float32Array(frames);
  for (let i = 0; i < frames; i++) fAll[i] = fFull[i] + 0.7 * fHigh[i] + 0.5 * fLow[i];
  const k = 2.4 - 1.9 * Math.min(1, Math.max(0, sens));
  const kicks = pickPeaks(fLow, hopSec, k, 0.16), hits = pickPeaks(fAll, hopSec, k, 0.09);
  // tempo : autocorrélation de la courbe d'attaque entre 70 et 180 battements par minute
  const lagMin = Math.floor(60 / 180 / hopSec), lagMax = Math.ceil(60 / 70 / hopSec), score = new Float64Array(lagMax + 2);
  for (let lag = lagMin; lag <= lagMax; lag++) { let s = 0; for (let i = 0; i + lag < frames; i++) s += fAll[i] * fAll[i + lag]; score[lag] = s / (frames - lag); }
  let best = lagMin; for (let lag = lagMin; lag <= lagMax; lag++) if (score[lag] > score[best]) best = lag;
  let lag = best;
  if (best > lagMin && best < lagMax) { const a = score[best - 1], b = score[best], c = score[best + 1], den = a - 2 * b + c; if (den) lag = best + (0.5 * (a - c)) / den; }   // interpolation parabolique
  let bpm = 60 / (lag * hopSec); while (bpm < 80) bpm *= 2; while (bpm > 165) bpm /= 2;
  // phase : décalage de la grille qui coïncide le mieux avec les attaques
  const P = 60 / bpm, steps = Math.max(1, Math.round(P / hopSec));
  let bestOff = 0, bestSum = -1;
  for (let o = 0; o < steps; o++) {
    let s = 0; for (let t = o * hopSec; t < frames * hopSec; t += P) { const fi = Math.round(t / hopSec); s += fAll[Math.min(frames - 1, fi)]; }
    if (s > bestSum) { bestSum = s; bestOff = o * hopSec; }
  }
  const beats: number[] = []; for (let t = bestOff; t < buf.duration; t += P) beats.push(t);
  const sorted = Float32Array.from(fAll).sort(), ref = sorted[Math.floor(sorted.length * 0.97)] || 1;   // 97e centile : les plus gros coups
  return { bpm: Math.round(bpm * 10) / 10, beats, kicks, hits, flux: fAll, hop: hopSec, ref };
}

/** Enveloppe pour dessiner la forme d'onde : `n` valeurs entre 0 et 1 (crête de chaque tranche). */
export function waveform(buf: AudioBuffer, n: number): Float32Array {
  const out = new Float32Array(n), len = buf.length, step = len / n;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) {
      let m = 0; const a = Math.floor(i * step), b = Math.min(len, Math.floor((i + 1) * step)), stride = Math.max(1, Math.floor((b - a) / 48));
      for (let j = a; j < b; j += stride) { const v = Math.abs(d[j]); if (v > m) m = v; }
      if (m > out[i]) out[i] = m;
    }
  }
  return out;
}

/** Lecture : une source à la fois, relancée à chaque départ (lecture, reprise, boucle). */
export class Player {
  private src: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  play(buf: AudioBuffer, offset: number, volume: number) {
    this.stop();
    if (offset >= buf.duration) return;
    const c = audioCtx(); if (c.state === 'suspended') void c.resume();
    const src = c.createBufferSource(), gain = c.createGain();
    src.buffer = buf; gain.gain.value = volume; src.connect(gain); gain.connect(c.destination);
    src.start(0, Math.max(0, offset)); this.src = src; this.gain = gain;
    src.onended = () => { if (this.src === src) { this.src = null; this.gain = null; } };
  }
  setVolume(v: number) { if (this.gain) this.gain.gain.value = v; }
  stop() { try { this.src?.stop(); } catch { /* déjà arrêtée */ } this.src?.disconnect(); this.src = null; this.gain = null; }
}
