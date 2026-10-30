import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseProject, stringifyProject, FORMAT_VERSION, type ParsedProject, type WrittenProject } from '../src/projectFile';

const dir = resolve(import.meta.dirname, 'fixtures');
const files = readdirSync(dir).filter(f => f.endsWith('.maxernzt'));
const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const layer = (o: object = {}) => ({ id: 1, name: 'a', image: 'i', border: 8, shadow: 20, x: 1, y: 2, rotation: 0.5, scaleX: 1, scaleY: 1, ...o });
const proj = (o: object = {}) => JSON.stringify({ format: 'maxernzt', images: { i: px }, layers: [layer()], ...o });

/** Ce que main.ts fait pour enregistrer : le projet lu redevient un projet à écrire. */
const toWritten = (p: ParsedProject): WrittenProject => ({
  paper: p.paper!, bg: p.bg!, paperTex: p.paperTex, paperAmt: p.paperAmt, tree: p.tree, duration: p.duration, images: p.images, audio: p.audio,
  layers: p.layers.map(l => ({ id: l.id, name: l.name, visible: l.visible, locked: l.locked || undefined, fx: l.fx, anim: l.anim, tl: l.tl, acc: l.acc, image: l.image, border: l.border, shadow: l.shadow, rough: l.rough, letter: l.letter, x: l.x, y: l.y, rotation: l.rot, scaleX: l.sx, scaleY: l.sy }) as WrittenProject['layers'][number]),
});

describe('parseProject / stringifyProject : fixtures', () => {
  describe.each(files)('%s', f => {
    const txt = readFileSync(resolve(dir, f), 'utf8'), original = JSON.parse(txt), p = parseProject(txt);

    it('se lit sans avertissement de version', () => {
      expect(p.version).toBe(2);
      expect(p.newer).toBe(false);
      expect(p.layers).toHaveLength(original.layers.length);
      expect(Object.keys(p.images)).toEqual(Object.keys(original.images));
      expect(p.tree).toEqual(original.tree);
      expect(p.paper).toEqual(original.paper);
    });

    it('relit les champs de chaque calque comme loadProject le faisait', () => {
      p.layers.forEach((l, i) => {
        const o = original.layers[i];
        expect(l).toMatchObject({ id: o.id, name: o.name, image: o.image, border: o.border, shadow: o.shadow, rough: o.rough, x: o.x, y: o.y, rot: o.rotation, sx: o.scaleX, sy: o.scaleY });
        expect(l.visible).toBe(o.visible !== false);
        expect(l.locked).toBe(!!o.locked);
      });
    });

    it('lecture → écriture redonne le même contenu, avec les champs dans le même ordre', () => {
      const out = stringifyProject(toWritten(p));
      expect(JSON.parse(out)).toEqual(original);
      expect(Object.keys(JSON.parse(out))).toEqual(Object.keys(original));
    });

    it('lecture → écriture → lecture est stable', () => {
      expect(parseProject(stringifyProject(toWritten(p)))).toEqual(p);
    });
  });
});

describe('parseProject : valeurs par défaut des anciens fichiers', () => {
  it('fichier minimal : version 1, calques à plat, défauts historiques', () => {
    const p = parseProject(proj());
    expect(p).toMatchObject({ version: 1, newer: false, paperTex: 'none', paperAmt: 70, duration: null, paper: undefined, bg: undefined, audio: undefined });
    expect(p.layers[0]).toMatchObject({ rough: 60, visible: true, locked: false });
    expect(p.tree).toEqual([{ l: 1 }]);
  });
  it('sans arbre : calques à plat dans l\'ordre de `layers`', () => {
    const p = parseProject(proj({ layers: [layer({ id: 7 }), layer({ id: 3 }), layer({ id: 9 })] }));
    expect(p.tree).toEqual([{ l: 7 }, { l: 3 }, { l: 9 }]);
  });
  it('visible=false et locked=true sont conservés ; rough=0 n\'est pas remplacé par 60', () => {
    const p = parseProject(proj({ layers: [layer({ visible: false, locked: true, rough: 0 })] }));
    expect(p.layers[0]).toMatchObject({ visible: false, locked: true, rough: 0 });
  });
  it('durée, intensité et taille de feuille : ignorées si elles ne sont pas du bon type', () => {
    const p = parseProject(proj({ duration: '12', paperAmt: 'x', paper: [100] }));
    expect(p).toMatchObject({ duration: null, paperAmt: 70, paper: undefined });
    expect(parseProject(proj({ duration: 0, paperAmt: 0, paper: [200, 100] }))).toMatchObject({ duration: 0, paperAmt: 0, paper: [200, 100] });
  });
  it('audio : gardé seulement s\'il a des données', () => {
    expect(parseProject(proj({ audio: { name: 'a', mime: 'audio/mp3' } })).audio).toBeUndefined();
    expect(parseProject(proj({ audio: { name: 'a', mime: 'audio/mp3', data: 'AAAA' } })).audio?.data).toBe('AAAA');
  });
});

describe('parseProject : versions et erreurs', () => {
  it('version plus récente : lue, mais signalée', () => {
    const p = parseProject(proj({ version: FORMAT_VERSION + 1 }));
    expect(p.newer).toBe(true);
    expect(p.layers).toHaveLength(1);
  });
  it.each([
    ['fichier vide', '  \n', /vide/],
    ['JSON invalide', '{"format":', /illisible/],
    ['pas un projet', JSON.stringify({ foo: 1 }), /non reconnu/],
    ['null', 'null', /non reconnu/],
    ['mauvais format', JSON.stringify({ format: 'autre', layers: [], images: {} }), /non reconnu/],
    ['layers absent', JSON.stringify({ format: 'maxernzt', images: {} }), /non reconnu/],
    ['images absentes', JSON.stringify({ format: 'maxernzt', layers: [] }), /images absentes/],
  ])('%s : erreur lisible', (_n, txt, re) => {
    expect(() => parseProject(txt)).toThrow(re);
  });
  it('calque qui pointe vers une image absente : refusé avant tout changement', () => {
    expect(() => parseProject(proj({ layers: [layer({ name: 'Fleur', image: 'zzz' })] }))).toThrow(/image manquante.*Fleur/);
  });
  it('projet sans calque : valide', () => {
    expect(parseProject(JSON.stringify({ format: 'maxernzt', images: {}, layers: [] })).layers).toEqual([]);
  });
});
