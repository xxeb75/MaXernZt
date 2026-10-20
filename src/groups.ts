// Arbre de groupes et sous-groupes. L'ordre des enfants va de l'arrière vers l'avant ;
// l'ordre d'empilement des calques est le parcours en profondeur de l'arbre.
export interface Group { id: number; name: string; collapsed: boolean; visible: boolean; anim?: unknown; tl?: unknown; children: Node[]; parent: Group | null }
export interface Leaf { id: number; parent: Group }
export type Node = Leaf | Group;
/** Forme sérialisée (historique, fichier projet). */
export type TNode = { l: number } | { g: number; name: string; collapsed: boolean; v?: boolean; a?: unknown; t?: unknown; c: TNode[] };

export const isGroup = (n: Node): n is Group => 'children' in n;

export function leavesOf(n: Node): Leaf[] { return isGroup(n) ? n.children.flatMap(leavesOf) : [n]; }

export function detach(n: Node) {
  const p = n.parent; if (!p) return;
  const i = p.children.indexOf(n); if (i >= 0) p.children.splice(i, 1);
}
export function attach(n: Node, p: Group, index = p.children.length) { n.parent = p; p.children.splice(index, 0, n); }

/** Supprime les groupes devenus vides, en remontant. */
export function prune(g: Group | null) {
  while (g && g.parent && g.children.length === 0) { const p: Group = g.parent; detach(g); g = p; }
}

/** Ancêtres d'un nœud, du parent direct jusqu'à la racine. */
export function ancestors(n: Node): Group[] {
  const out: Group[] = []; let p = n.parent;
  while (p) { out.push(p); p = p.parent; }
  return out;
}
/** Le nœud de plus haut niveau (enfant direct de la racine) qui contient `n`. */
export function topNode(n: Node, root: Group): Node {
  let c: Node = n;
  while (c.parent && c.parent !== root) c = c.parent;
  return c;
}
/** Plus petit groupe qui contient tous ces nœuds. */
export function lca(nodes: Node[]): Group {
  let common = ancestors(nodes[0]);
  for (const n of nodes.slice(1)) { const a = new Set(ancestors(n)); common = common.filter(g => a.has(g)); }
  return common[0];
}
/** L'enfant direct de `a` qui contient `n`. */
export function childOf(a: Group, n: Node): Node {
  let c: Node = n;
  while (c.parent !== a) c = c.parent!;
  return c;
}
/** `g` est `n` ou l'un de ses ancêtres. */
export function contains(g: Group, n: Node): boolean {
  let c: Node | null = n;
  while (c) { if (c === g) return true; c = c.parent; }
  return false;
}

export function serialize(g: Group): TNode[] {
  return g.children.map((c): TNode => (isGroup(c) ? { g: c.id, name: c.name, collapsed: c.collapsed, v: c.visible, a: c.anim, t: c.tl, c: serialize(c) } : { l: c.id }));
}
export function buildTree(t: TNode[], parent: Group, leafOf: (id: number) => Leaf | undefined, mk: (id: number, name: string, collapsed: boolean, visible: boolean, anim: unknown, tl: unknown) => Group) {
  for (const n of t) {
    if ('l' in n) { const l = leafOf(n.l); if (l) attach(l, parent); }
    else { const g = mk(n.g, n.name, n.collapsed, n.v !== false, n.a, n.t); attach(g, parent); buildTree(n.c, g, leafOf, mk); }
  }
}
