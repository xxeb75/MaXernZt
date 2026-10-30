import { describe, it, expect } from 'vitest';
import { type Group, type Leaf, type Node, type TNode, isGroup, leavesOf, detach, attach, prune, ancestors, topNode, lca, childOf, contains, serialize, buildTree } from '../src/groups';

const mkRoot = (): Group => ({ id: 0, name: '', collapsed: false, visible: true, children: [], parent: null });
const mkGroup = (id: number, parent: Group, extra: Partial<Group> = {}): Group => { const g: Group = { id, name: 'g' + id, collapsed: false, visible: true, children: [], parent, ...extra }; attach(g, parent); return g; };
const mkLeaf = (id: number, parent: Group, index?: number): Leaf => { const l: Leaf = { id, parent }; attach(l, parent, index); return l; };
const ids = (g: Group) => g.children.map(c => (isGroup(c) ? 'g' + c.id : 'l' + c.id));

describe('arbre de groupes', () => {
  it('isGroup distingue groupe et feuille', () => {
    const r = mkRoot();
    expect(isGroup(r)).toBe(true);
    expect(isGroup(mkLeaf(1, r))).toBe(false);
  });

  it("attach ajoute à la fin par défaut, ou à l'index demandé", () => {
    const r = mkRoot();
    mkLeaf(1, r); mkLeaf(2, r); mkLeaf(3, r, 1);
    expect(ids(r)).toEqual(['l1', 'l3', 'l2']);
    expect(r.children.every(c => c.parent === r)).toBe(true);
  });

  it('detach retire le nœud de son parent sans toucher aux autres', () => {
    const r = mkRoot(); const a = mkLeaf(1, r); mkLeaf(2, r);
    detach(a);
    expect(ids(r)).toEqual(['l2']);
    detach(a); // déjà détaché : sans effet
    expect(ids(r)).toEqual(['l2']);
  });

  it("detach d'un nœud sans parent ne plante pas", () => {
    expect(() => detach({ id: 9, parent: null } as unknown as Node)).not.toThrow();
  });

  it("attach déplace : detach puis attach conserve l'ordre voulu", () => {
    const r = mkRoot(); const g = mkGroup(10, r); const a = mkLeaf(1, r); mkLeaf(2, r);
    detach(a); attach(a, g);
    expect(ids(r)).toEqual(['g10', 'l2']);
    expect(ids(g)).toEqual(['l1']);
    expect(a.parent).toBe(g);
  });

  it("prune supprime les groupes vides en remontant, mais pas la racine ni un groupe non vide", () => {
    const r = mkRoot(); const g1 = mkGroup(1, r); const g2 = mkGroup(2, g1); mkLeaf(5, r);
    prune(g2);
    expect(ids(r)).toEqual(['l5']);
    const g3 = mkGroup(3, r); mkLeaf(6, g3); const g4 = mkGroup(4, g3);
    prune(g4);
    expect(ids(r)).toEqual(['l5', 'g3']);
    expect(ids(g3)).toEqual(['l6']);
    prune(r); prune(null);
    expect(ids(r)).toEqual(['l5', 'g3']);
  });

  it('leavesOf parcourt en profondeur, arrière vers avant', () => {
    const r = mkRoot(); mkLeaf(1, r); const g = mkGroup(10, r); mkLeaf(2, g); const h = mkGroup(11, g); mkLeaf(3, h); mkLeaf(4, g); mkLeaf(5, r);
    expect(leavesOf(r).map(l => l.id)).toEqual([1, 2, 3, 4, 5]);
    expect(leavesOf(g).map(l => l.id)).toEqual([2, 3, 4]);
    expect(leavesOf(r.children[0]).map(l => l.id)).toEqual([1]);
  });

  describe('relations', () => {
    const r = mkRoot(); const g = mkGroup(10, r); const h = mkGroup(11, g); const a = mkLeaf(1, h); const b = mkLeaf(2, g); const c = mkLeaf(3, r);

    it('ancestors : du parent direct à la racine', () => {
      expect(ancestors(a)).toEqual([h, g, r]);
      expect(ancestors(r)).toEqual([]);
    });
    it('topNode : enfant direct de la racine qui contient le nœud', () => {
      expect(topNode(a, r)).toBe(g);
      expect(topNode(c, r)).toBe(c);
    });
    it('lca : plus petit groupe contenant tous les nœuds', () => {
      expect(lca([a, b])).toBe(g);
      expect(lca([a, c])).toBe(r);
      expect(lca([a])).toBe(h);
    });
    it('childOf : enfant direct de `a` qui contient `n`', () => {
      expect(childOf(g, a)).toBe(h);
      expect(childOf(g, b)).toBe(b);
    });
    it('contains : vrai pour le nœud lui-même et ses ancêtres', () => {
      expect(contains(g, a)).toBe(true);
      expect(contains(a as unknown as Group, a)).toBe(true);
      expect(contains(h, b)).toBe(false);
    });
  });

  describe('serialize / buildTree', () => {
    const build = () => {
      const r = mkRoot(); mkLeaf(1, r);
      const g = mkGroup(10, r, { name: 'Mon groupe', collapsed: true, visible: false, locked: true, anim: { a: 1 }, tl: { t: 2 } });
      mkLeaf(2, g); const h = mkGroup(11, g); mkLeaf(3, h); mkLeaf(4, r);
      return r;
    };

    it('serialize reproduit la forme documentée (l / g, v, k, a, t, c)', () => {
      expect(serialize(build())).toEqual([
        { l: 1 },
        { g: 10, name: 'Mon groupe', collapsed: true, v: false, k: true, a: { a: 1 }, t: { t: 2 }, c: [
          { l: 2 },
          { g: 11, name: 'g11', collapsed: false, v: true, k: undefined, a: undefined, t: undefined, c: [{ l: 3 }] },
        ] },
        { l: 4 },
      ]);
    });

    it('survit à un aller-retour JSON (fichier projet)', () => {
      const t = JSON.parse(JSON.stringify(serialize(build()))) as TNode[];
      const leaves = new Map<number, Leaf>([1, 2, 3, 4].map(i => [i, { id: i, parent: null as unknown as Group }]));
      const r2 = mkRoot();
      buildTree(t, r2, id => leaves.get(id), (id, name, collapsed, visible, anim, tl, locked) => ({ id, name, collapsed, visible, locked: locked || undefined, anim, tl, children: [], parent: r2 }));
      expect(serialize(r2)).toEqual(JSON.parse(JSON.stringify(serialize(build()))));
      expect(leavesOf(r2).map(l => l.id)).toEqual([1, 2, 3, 4]);
      const g = r2.children[1] as Group;
      expect(g.locked).toBe(true); expect(g.visible).toBe(false); expect(g.collapsed).toBe(true);
      expect(leaves.get(3)!.parent).toBe(g.children[1]);
    });

    it("buildTree : visible absent = visible, verrou absent = déverrouillé (anciens fichiers)", () => {
      const r = mkRoot(); const made: Group[] = [];
      buildTree([{ g: 7, name: 'x', collapsed: false, c: [] }], r, () => undefined, (id, name, collapsed, visible, anim, tl, locked) => { const g = { id, name, collapsed, visible, locked, anim, tl, children: [], parent: r } as Group; made.push(g); return g; });
      expect(made[0].visible).toBe(true);
      expect(made[0].locked).toBe(false);
    });

    it('buildTree ignore une feuille inconnue sans planter', () => {
      const r = mkRoot();
      buildTree([{ l: 99 }, { l: 1 }], r, id => (id === 1 ? { id: 1, parent: null as unknown as Group } : undefined), () => { throw new Error('inattendu'); });
      expect(ids(r)).toEqual(['l1']);
    });
  });
});
