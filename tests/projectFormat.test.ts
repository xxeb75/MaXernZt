import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Group, type Leaf, type TNode, buildTree, serialize, leavesOf, isGroup } from '../src/groups';

const dir = resolve(import.meta.dirname, 'fixtures');
const files = readdirSync(dir).filter(f => f.endsWith('.maxernzt'));

interface Proj { format: string; version?: number; paper?: number[]; images: Record<string, string>; layers: { id: number; image: string; [k: string]: unknown }[]; tree?: TNode[]; [k: string]: unknown }

const treeLeafIds = (t: TNode[]): number[] => t.flatMap(n => ('l' in n ? [n.l] : treeLeafIds(n.c)));
const rebuild = (d: Proj) => {
  const root: Group = { id: 0, name: '', collapsed: false, visible: true, children: [], parent: null };
  const leaves = new Map<number, Leaf>(d.layers.map(l => [l.id, { id: l.id, parent: null as unknown as Group }]));
  buildTree(d.tree!, root, id => leaves.get(id), (id, name, collapsed, visible, anim, tl, locked) => ({ id, name, collapsed, visible, locked: locked || undefined, anim, tl, children: [], parent: root }));
  return root;
};

// Un projet avec groupes, verrou, masquage, trajectoire : aucun exemple du site n'en contient.
const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const withGroups: Proj = {
  format: 'maxernzt', version: 2, paper: [1080, 1920], bg: '#ffffff', paperTex: 'none', paperAmt: 70, duration: null, images: { img0: px },
  layers: [1, 2, 3, 4].map(id => ({ id, name: 'c' + id, visible: true, image: 'img0', border: 10, shadow: 30, rough: 60, x: id * 10, y: 5, rotation: 0, scaleX: 1, scaleY: 1 })),
  tree: [{ l: 1 }, { g: 10, name: 'G', collapsed: false, v: false, k: true, a: { pts: [{ x: 0, y: 0 }, { x: 5, y: 5 }], dur: 2, mode: 'loop', ease: 'smooth', follow: false }, c: [{ l: 2 }, { g: 11, name: 'H', collapsed: true, c: [{ l: 3 }] }] }, { l: 4 }],
};
// Ancien fichier : ni version, ni tree, ni rough, ni paperAmt.
const legacy = { format: 'maxernzt', images: { a: px }, layers: [{ id: 5, name: 'x', image: 'a', border: 8, shadow: 20, x: 1, y: 2, rotation: 0.5, scaleX: 1, scaleY: 1 }] };

describe('format .maxernzt : fixtures figées', () => {
  it('les 4 exemples historiques sont présents', () => {
    expect([...files].sort()).toEqual(['affiche-kraft.maxernzt', 'ciel-de-nuit.maxernzt', 'danse-sur-le-son.maxernzt', 'mots-qui-dansent.maxernzt']);
  });

  describe.each(files)('%s', f => {
    const d = JSON.parse(readFileSync(resolve(dir, f), 'utf8')) as Proj;

    it('est un projet reconnu, version 2, avec une feuille valide', () => {
      expect(d.format).toBe('maxernzt');
      expect(d.version).toBe(2);
      expect(d.paper).toHaveLength(2);
      expect(d.paper!.every(n => Number.isInteger(n) && n > 0)).toBe(true);
      expect(Array.isArray(d.layers)).toBe(true);
    });

    it('chaque calque référence une image PNG existante, les ids sont uniques', () => {
      for (const l of d.layers) expect(d.images[l.image], `image du calque ${l.id}`).toMatch(/^data:image\/png;base64,/);
      const ids = d.layers.map(l => l.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("les feuilles de l'arbre sont exactement les calques, dans l'ordre", () => {
      expect(treeLeafIds(d.tree!)).toEqual(d.layers.map(l => l.id));
    });

    it("l'arbre se reconstruit et se resérialise à l'identique", () => {
      const root = rebuild(d);
      expect(JSON.parse(JSON.stringify(serialize(root)))).toEqual(JSON.parse(JSON.stringify(d.tree)));
    });
  });
});

describe('format .maxernzt : cas synthétiques', () => {
  it('projet avec groupes : ordre, verrou, visibilité et trajectoire conservés', () => {
    const root = rebuild(withGroups);
    expect(leavesOf(root).map(l => l.id)).toEqual([1, 2, 3, 4]);
    const g = root.children[1] as Group, h = g.children[1] as Group;
    expect(isGroup(g) && isGroup(h)).toBe(true);
    expect([g.visible, g.locked, h.collapsed, h.visible]).toEqual([false, true, true, true]);
    expect((g.anim as { dur: number }).dur).toBe(2);
    // la resérialisation écrit explicitement ce qui était implicite (v absent -> true)
    const out = serialize(root)[1] as Extract<TNode, { g: number }>;
    expect(out.v).toBe(false); expect(out.k).toBe(true); expect((out.c[1] as Extract<TNode, { g: number }>).v).toBe(true);
  });

  it('ancien fichier sans `tree` ni `version` : calques à plat dans l\'ordre de `layers`', () => {
    // loadProject : tree = Array.isArray(d.tree) ? d.tree : layers.map(l => ({ l: l.id }))
    const d = legacy as unknown as Proj;
    expect(d.version).toBeUndefined();
    expect(d.tree).toBeUndefined();
    const tree = d.layers.map(l => ({ l: l.id }));
    expect(treeLeafIds(tree)).toEqual([5]);
  });
});
