// Lecture et écriture du JSON d'un projet .maxernzt, sans DOM ni Pixi (le décodage des images reste dans main.ts).
// Le format est décrit dans docs/FORMAT.md. Il est tolérant à la lecture : un champ absent reçoit sa valeur par défaut historique.
import type { TNode } from './groups';
import type { Anim, TL } from './anim';
import type { LayerFx } from './filters';
import type { LetterSpec } from './letters';
import type { AccParams } from './accessories';

/** Version écrite dans les fichiers. À incrémenter avec une migration explicite si le format change. */
export const FORMAT_VERSION = 2;

export interface FileLayer {
  id: number; name: string; visible: boolean; locked: boolean;
  fx?: LayerFx; anim?: Anim; tl?: TL; acc?: { kind: string; p: AccParams }; letter?: LetterSpec;
  /** clé dans `images` */ image: string;
  border: number; shadow: number; rough: number;
  /** pose de repos */ x: number; y: number; rot: number; sx: number; sy: number;
}
export interface FileAudio { name: string; mime: string; data: string; vol?: number; muted?: boolean; sens?: number; src?: 'kicks' | 'beats' | 'hits' }
export interface ParsedProject {
  version: number;
  /** plus récent que ce que cette version sait lire : le chargement continue, mais l'appelant devrait prévenir */
  newer: boolean;
  paper?: [number, number]; bg?: string; paperTex: string; paperAmt: number; duration: number | null;
  tree: TNode[]; layers: FileLayer[]; images: Record<string, string>; audio?: FileAudio;
}

/** Lit et valide un projet. Lève une `Error` au message lisible ; ne touche à aucun état de l'appli. */
export function parseProject(txt: string): ParsedProject {
  if (!txt.trim()) throw new Error('le fichier est vide (enregistrement interrompu)');
  let d: any;
  try { d = JSON.parse(txt); } catch { throw new Error("fichier illisible (ce n'est pas un projet MaXernZt)"); }
  if (!d || d.format !== 'maxernzt' || !Array.isArray(d.layers)) throw new Error('fichier non reconnu');
  if (!d.images || typeof d.images !== 'object') throw new Error('fichier incomplet : images absentes');
  const layers: FileLayer[] = d.layers.map((l: any) => {
    if (typeof d.images[l.image] !== 'string') throw new Error(`fichier incomplet : image manquante pour le calque « ${l.name ?? l.id} »`);
    return { id: l.id, name: l.name, visible: l.visible !== false, locked: !!l.locked, fx: l.fx, anim: l.anim, tl: l.tl, acc: l.acc, image: l.image, border: l.border, shadow: l.shadow, rough: l.rough ?? 60, letter: l.letter, x: l.x, y: l.y, rot: l.rotation, sx: l.scaleX, sy: l.scaleY };
  });
  const version = typeof d.version === 'number' ? d.version : 1;
  return {
    version, newer: version > FORMAT_VERSION,
    paper: Array.isArray(d.paper) && d.paper.length === 2 ? [d.paper[0], d.paper[1]] : undefined,
    bg: d.bg ?? undefined, paperTex: d.paperTex ?? 'none', paperAmt: typeof d.paperAmt === 'number' ? d.paperAmt : 70,
    duration: typeof d.duration === 'number' ? d.duration : null,
    tree: Array.isArray(d.tree) ? d.tree : layers.map(l => ({ l: l.id })),
    layers, images: d.images, audio: d.audio?.data ? d.audio : undefined,
  };
}

/** Champs d'un calque tels qu'écrits dans le fichier (l'image est désignée par sa clé dans `images`). */
export interface WrittenLayer {
  id: number; name: string; visible: boolean; locked?: true; fx?: LayerFx; anim?: Anim; tl?: TL; acc?: { kind: string; p: AccParams }; image: string;
  border: number; shadow: number; rough: number; letter?: LetterSpec; x: number; y: number; rotation: number; scaleX: number; scaleY: number;
}
export interface WrittenProject {
  paper: [number, number]; bg: string; paperTex: string; paperAmt: number; tree: TNode[]; duration: number | null;
  layers: WrittenLayer[]; images: Record<string, string>; audio?: FileAudio;
}

/** Écrit le JSON du projet (l'ordre des champs est celui des fichiers existants). */
export function stringifyProject(p: WrittenProject): string {
  return JSON.stringify({ format: 'maxernzt', version: FORMAT_VERSION, paper: p.paper, bg: p.bg, paperTex: p.paperTex, paperAmt: p.paperAmt, tree: p.tree, duration: p.duration, layers: p.layers, images: p.images, audio: p.audio });
}
