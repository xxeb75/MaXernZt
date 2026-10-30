# Format de fichier `.maxernzt`

Documente le format **tel qu'écrit et lu aujourd'hui** (`projectJson()` et `loadProject()` dans `src/main.ts`).
Un `.maxernzt` est un fichier JSON UTF-8. Tout changement de format doit passer par une nouvelle `version`
et une migration explicite : les fixtures de `tests/fixtures/` doivent continuer à se charger.

## Racine

| Champ | Type | Remarque |
|---|---|---|
| `format` | `"maxernzt"` | Obligatoire à la lecture, sinon « fichier non reconnu ». |
| `version` | nombre | Écrit (actuellement `2`) mais **pas encore contrôlé** à la lecture. |
| `paper` | `[largeur, hauteur]` | Taille de la feuille en pixels. Absent ou invalide : la taille courante est conservée. |
| `bg` | `"#rrggbb"` | Couleur de fond. Absent : couleur courante. |
| `paperTex` | `"none"`, `"papier"`, `"kraft"`, `"quadrille"`… | Texture de papier. Absent : `none`. |
| `paperAmt` | nombre | Intensité de la texture. Absent ou non numérique : `70`. |
| `tree` | `TNode[]` | Arbre des groupes (voir ci-dessous). Absent : tous les calques à plat, dans l'ordre de `layers`. |
| `duration` | nombre ou `null` | Durée de la timeline fixée à la main. Autre chose qu'un nombre : `null` (durée automatique). |
| `layers` | `Layer[]` | Obligatoire (tableau). |
| `images` | `{ [id]: dataURL }` | Obligatoire. PNG en `data:image/png;base64,…`, partagés entre calques identiques. |
| `audio` | objet, optionnel | Voir ci-dessous. |

## Calque (`layers[i]`)

| Champ | Remarque |
|---|---|
| `id` | Entier unique, stable. Le prochain id libre est recalculé au chargement. |
| `name` | |
| `visible` | Absent ou autre que `false` : visible. |
| `locked` | Écrit seulement s'il est vrai. Absent : déverrouillé. |
| `image` | Clé dans `images`. |
| `border`, `shadow` | Réglages de contour et d'ombre. |
| `rough` | Déchirure du contour. Absent : `60`. |
| `x`, `y`, `rotation`, `scaleX`, `scaleY` | **Pose de repos** (jamais la pose animée). `rotation` en radians. |
| `fx` | Effets de couleur (optionnel). |
| `anim` | Trajectoire : `{ pts, dur, mode, ease, follow, keys?, turns? }` (optionnel). |
| `tl` | Timeline : `{ pos?, rot?, scale?, crumple?, vis? }`, chacun une liste de `{ t, v, w?, e? }` (optionnel). |
| `acc` | Accessoire généré : `{ kind, p }` (optionnel). |
| `letter` | Lettre générée (optionnel). |

## Arbre (`tree`)

Liste d'ordre arrière → avant. L'ordre d'empilement des calques est le parcours en profondeur.

- feuille : `{ "l": <id calque> }`
- groupe : `{ "g": <id>, "name", "collapsed", "v"?: visible, "k"?: verrouillé, "a"?: anim, "t"?: tl, "c": TNode[] }`
  - `v` absent : visible. `k` absent : déverrouillé.
- Une feuille dont l'id n'existe pas dans `layers` est ignorée.

## Audio (optionnel)

`{ name, mime, data (base64), vol, muted, sens, src }`

## Invariants testés

Voir `tests/projectFormat.test.ts` : chaque calque référence une image existante, les ids sont uniques,
les feuilles de l'arbre correspondent exactement aux calques, les images sont des PNG, l'arbre se reconstruit
et se resérialise à l'identique.
