import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Anim, type TL, type PropId, type KEase, cum, pathAt, totalOf, keyStarts, ballAfter, evalAnim, evalTL, putKeyIn, removeKeyIn, keyTimesOf, PROPS, defEase, smooth } from '../src/anim';

// anim.golden.json : valeurs calculées par le code d'origine de main.ts (avant l'extraction vers anim.ts).
// Elles figent le comportement ; ne les régénère que si un changement de comportement est voulu.
const golden = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/anim.golden.json'), 'utf8'));
const roundtrip = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe('anim : fidélité au code d\'origine (valeurs de référence)', () => {
  describe.each(Object.keys(golden.anims))('trajectoire « %s »', name => {
    const g = golden.anims[name], a = g.anim as Anim;
    it('durée totale, longueurs cumulées, débuts de pause, états chiffonnés', () => {
      expect(totalOf(a)).toBe(g.total);
      expect(cum(a)).toEqual(g.cum);
      expect(keyStarts(a)).toEqual(g.keyStarts);
      expect((a.keys ?? []).map((_, i) => ballAfter(a, i))).toEqual(g.ballAfter);
    });
    it('evalAnim sur 0 → 14 s (et temps négatifs)', () => {
      for (const [t, expected] of g.eval) expect(roundtrip(evalAnim(a, t)), `t=${t}`).toEqual(expected);
    });
    it('pathAt, abscisse bornée à [0, 1]', () => {
      for (const [u, expected] of g.pathAt) expect(roundtrip(pathAt(a, u)), `u=${u}`).toEqual(expected);
    });
  });

  describe.each(Object.keys(golden.tls))('timeline « %s »', name => {
    const g = golden.tls[name], tl = g.tl as TL | undefined;
    it('evalTL', () => { for (const [t, expected] of g.eval) expect(roundtrip(evalTL(tl, t)), `t=${t}`).toEqual(expected); });
    if (g.times) it('keyTimesOf', () => expect(keyTimesOf(tl)).toEqual(g.times));
  });

  it('putKeyIn / removeKeyIn rejouent les séquences de référence', () => {
    for (const seq of golden.put as { op: string; prop: PropId; t: number; v?: number; w?: number; e?: KEase; tl: TL | null }[][]) {
      let tl: TL | undefined;
      for (const s of seq) {
        tl = s.op === 'put' ? putKeyIn(tl, s.prop, s.t, s.v!, s.w, s.e) : removeKeyIn(tl, s.prop, s.t);
        expect(roundtrip(tl ?? null), `${s.op} ${s.prop} t=${s.t}`).toEqual(s.tl);
      }
    }
  });

  it('defEase : visibilité en palier, le reste adouci', () => {
    expect(golden.defEase).toEqual(PROPS.map(p => [p.id, defEase(p.id)]));
  });
});

describe('anim : propriétés documentées', () => {
  const line: Anim = { pts: [{ x: 0, y: 0 }, { x: 100, y: 0 }], dur: 2, mode: 'loop', ease: 'linear', follow: false };

  it('smooth : 0 → 0, 1 → 1, symétrique', () => {
    expect([smooth(0), smooth(0.5), smooth(1)]).toEqual([0, 0.5, 1]);
  });
  it('trajet linéaire : mi-parcours à mi-durée, boucle à la fin du cycle', () => {
    expect(evalAnim(line, 1).x).toBeCloseTo(50);
    expect(evalAnim(line, 2).x).toBeCloseTo(0);
    expect(evalAnim(line, 0).x).toBe(0);
  });
  it('aller-retour : revient au point de départ après un cycle double', () => {
    const pp: Anim = { ...line, mode: 'pingpong' };
    expect(evalAnim(pp, 2).x).toBeCloseTo(100);
    expect(evalAnim(pp, 3).x).toBeCloseTo(50);
    expect(evalAnim(pp, 4).x).toBeCloseTo(0);
  });
  it('une pause allonge le cycle de sa durée', () => {
    const k: Anim = { ...line, keys: [{ u: 0.5, hold: 1, spin: 0 }] };
    expect(totalOf(k)).toBe(3);
    expect(evalAnim(k, 1.5).x).toBeCloseTo(50);
  });

  describe('images clés de timeline', () => {
    it('putKeyIn ne modifie pas la TL reçue (immuabilité)', () => {
      const before: TL = { rot: [{ t: 0, v: 0 }] }, snap = roundtrip(before);
      const after = putKeyIn(before, 'rot', 1, 90);
      expect(before).toEqual(snap);
      expect(after).not.toBe(before);
    });
    it('première clé après 0,05 s : ajoute un départ à la valeur de repos', () => {
      const tl = putKeyIn(undefined, 'scale', 2, 3);
      expect(tl.scale).toEqual([{ t: 0, v: 1, e: 'smooth' }, { t: 2, v: 3, e: 'smooth' }]);
    });
    it('clé proche (< 0,02 s) : mise à jour au lieu d\'un doublon', () => {
      let tl = putKeyIn(undefined, 'rot', 0, 10);
      tl = putKeyIn(tl, 'rot', 0.01, 20);
      expect(tl.rot).toHaveLength(1);
      expect(tl.rot![0].v).toBe(20);
    });
    it('les clés restent triées par instant', () => {
      let tl = putKeyIn(undefined, 'rot', 3, 1);
      tl = putKeyIn(tl, 'rot', 1, 2);
      expect(tl.rot!.map(k => k.t)).toEqual([0, 1, 3]);
    });
    it('removeKeyIn : retirer la dernière clé d\'une propriété la supprime, puis la TL vide devient undefined', () => {
      const tl = putKeyIn(undefined, 'vis', 0, 0);
      expect(removeKeyIn(tl, 'vis', 0)).toBeUndefined();
      expect(removeKeyIn(undefined, 'vis', 0)).toBeUndefined();
    });
    it('valeurs avant la première et après la dernière clé : tenues', () => {
      const tl: TL = { rot: [{ t: 1, v: 10 }, { t: 2, v: 30, e: 'linear' }] };
      expect(evalTL(tl, 0).rot).toBe(10);
      expect(evalTL(tl, 9).rot).toBe(30);
      expect(evalTL({ rot: [{ t: 1, v: 10, e: 'linear' }, { t: 2, v: 30 }] }, 1.5).rot).toBe(20);
    });
    it('palier (hold) : garde la valeur jusqu\'à la clé suivante', () => {
      expect(evalTL({ vis: [{ t: 0, v: 0, e: 'hold' }, { t: 1, v: 1 }] }, 0.99).vis).toBe(0);
    });
  });
});
