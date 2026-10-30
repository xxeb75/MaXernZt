import { describe, it, expect } from 'vitest';
import { analyse, strengthAt, waveform, type Analysis } from '../src/audio';

/** AudioBuffer minimal : analyse() et waveform() n'utilisent que ces membres. */
function fakeBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  return { sampleRate, length: channels[0].length, numberOfChannels: channels.length, duration: channels[0].length / sampleRate, getChannelData: (c: number) => channels[c] } as unknown as AudioBuffer;
}

/** Une grosse caisse synthétique (sinus 60 Hz à décroissance rapide) tous les 60/bpm secondes, commençant à `first` s. */
function kickTrack(bpm: number, seconds: number, first = 0.1, sr = 22050): AudioBuffer {
  const x = new Float32Array(Math.round(seconds * sr)), period = 60 / bpm;
  for (let t = first; t < seconds - 0.3; t += period) {
    const s0 = Math.round(t * sr);
    for (let i = 0; i < 0.25 * sr && s0 + i < x.length; i++) x[s0 + i] += Math.sin((2 * Math.PI * 60 * i) / sr) * Math.exp(-i / (0.05 * sr));
  }
  return fakeBuffer([x], sr);
}

describe('analyse : cas limites', () => {
  it('signal trop court : analyse vide, sans erreur', () => {
    const a = analyse(fakeBuffer([new Float32Array(100)], 22050));
    expect(a).toMatchObject({ bpm: 0, beats: [], kicks: [], hits: [], ref: 0 });
    expect(a.flux).toHaveLength(0);
  });

  it('silence : aucune attaque détectée', () => {
    const a = analyse(fakeBuffer([new Float32Array(22050 * 5)], 22050));
    expect(a.kicks).toEqual([]);
    expect(a.hits).toEqual([]);
  });
});

describe('analyse : grosse caisse régulière à 120 BPM', () => {
  const buf = kickTrack(120, 12), a = analyse(buf);

  it('retrouve le tempo', () => {
    expect(a.bpm).toBeGreaterThan(118);
    expect(a.bpm).toBeLessThan(122);
  });

  it('trouve les coups de grosse caisse, calés sur la grille de 0,5 s', () => {
    expect(a.kicks.length).toBeGreaterThanOrEqual(18);
    expect(a.kicks.length).toBeLessThanOrEqual(26);
    for (const k of a.kicks) { const r = ((k - 0.1) / 0.5) % 1; expect(Math.min(r, 1 - r) * 0.5, `coup à ${k.toFixed(3)} s`).toBeLessThan(0.06); }
  });

  it('grille de temps régulière, à la période du tempo, sur toute la durée', () => {
    const P = 60 / a.bpm;
    expect(a.beats.length).toBeGreaterThan(20);
    const gap = a.beats[1] - a.beats[0];   // le bpm affiché est arrondi à 0,1 : la grille utilise la période exacte
    expect(Math.abs(gap - P)).toBeLessThan(0.001);
    for (let i = 1; i < a.beats.length; i++) expect(a.beats[i] - a.beats[i - 1]).toBeCloseTo(gap, 6);
    expect(a.beats[0]).toBeLessThan(P);
    expect(a.beats[a.beats.length - 1]).toBeLessThan(buf.duration);
  });

  it('la sensibilité ne retire jamais de coups quand elle monte', () => {
    expect(analyse(buf, 1).hits.length).toBeGreaterThanOrEqual(analyse(buf, 0).hits.length);
  });
});

describe('strengthAt', () => {
  const mk = (flux: number[], ref: number): Analysis => ({ bpm: 0, beats: [], kicks: [], hits: [], flux: Float32Array.from(flux), hop: 0.1, ref });

  it('sans courbe ou sans référence : force neutre 0,5', () => {
    expect(strengthAt(mk([], 1), 1)).toBe(0.5);
    expect(strengthAt(mk([1, 2], 0), 0)).toBe(0.5);
  });
  it('proportionnelle au pic proche, plafonnée à 1', () => {
    const a = mk([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0], 10);
    expect(strengthAt(a, 1.0)).toBe(0.5);   // pic de 5 à l'indice 10, référence 10
    expect(strengthAt(a, 0)).toBe(0);       // trop loin du pic
    expect(strengthAt(mk([20], 10), 0)).toBe(1);
  });
});

describe('waveform', () => {
  it('une valeur par tranche, crête entre 0 et 1, tous canaux confondus', () => {
    const l = new Float32Array(1000), r = new Float32Array(1000);
    l[10] = -0.5; r[990] = 0.9;
    const w = waveform(fakeBuffer([l, r], 1000), 4);
    expect(w).toHaveLength(4);
    expect(w[0]).toBeCloseTo(0.5);
    expect(w[3]).toBeCloseTo(0.9);
    expect(w[1]).toBe(0);
  });
});
