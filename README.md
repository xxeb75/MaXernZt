# MaXernZt

Atelier de collage : chaque morceau de papier est un calque indépendant (déplaçable, animable, exportable).

## Lancer

```bash
npm install
npm run dev      # http://localhost:5173
```

## Application Windows (Tauri)

```bash
npm install
npm run tauri -- build --no-bundle    # produit src-tauri/target/release/maxernzt.exe (modèles d'IA embarqués)
npm run tauri -- dev                  # fenêtre de développement
```

Prérequis : Rust (toolchain MSVC), Visual Studio Build Tools, WebView2. Dans l'application, l'enregistrement et les exports utilisent les boîtes de dialogue natives de Windows (plus de fichier vide).

## Détourage IA (optionnel)

Place un modèle ONNX U²-Net dans `public/models/u2netp.onnx` (≈ 4,6 Mo, licence Apache 2.0, par ex. la version distribuée
avec le projet `rembg`). Sans lui, « Détourer (IA) » affiche un message ; « Détourer fond uni » fonctionne sans modèle.

## Détourage au clic (MobileSAM)

Fichiers ONNX à placer dans `public/models/` (Apache 2.0, dépôt Hugging Face `Acly/MobileSAM`) :
`mobile_sam_image_encoder.onnx` (≈ 28 Mo) et `sam_mask_decoder_single.onnx` (≈ 16,5 Mo).
Outil « Détourer au clic » : clic sur l'objet → aperçu ; Maj+clic ajoute une zone, Alt+clic en retire une ; Entrée découpe en nouveau calque, Échap annule.

## Outils actuels

- Import (bouton, glisser-déposer, Ctrl+V), détourage IA ou fond uni
- Ciseaux : tracé ouvert = le papier est coupé en deux le long du tracé (extrémités prolongées), on garde les ciseaux et le plus gros morceau pour recouper ; bouton « jeter la chute » ; tracé fermé (on revient au point de départ) = on découpe l'intérieur. Déchirure : même principe, tracé libre, bord fibreux
- Contour blanc organique (épaisseur inégale, bord arraché, fibres ; curseur d'irrégularité), ombre réglable par calque, miroir, duplication, ordre
- Lettres découpées : mot sur un même papier ou une lettre par papier, choix de la police (ou mélange), des couleurs (préréglages, mélange ou personnalisées), bords coupés → déchirés, état neuf → crade, aperçu en direct et tirage (dé)
- Double-clic sur une lettre : le panneau s'ouvre avec son style et la modifie en direct (police, couleurs, bords, état, tirage, texte) ; le style est mémorisé dans le projet
- Groupes et sous-groupes (Ctrl+G / Ctrl+Maj+G) : sélection multiple (Maj+clic, cadre de sélection, Ctrl+A), déplacement/taille/rotation/miroir/duplication/ordre appliqués à tout le groupe, arbre repliable dans le panneau de calques (glisser-déposer pour ranger, double-clic pour renommer, boutons dupliquer et œil à droite de chaque ligne), hiérarchie conservée dans le projet et dans le manifeste d'export. Sur le canvas, un clic sélectionne un seul élément ; un groupe entier se sélectionne depuis le panneau de calques. Œil par élément et par groupe (un groupe masqué masque tout son contenu ; l'état est conservé dans le projet et exclu de l'export PNG)
- Accessoires (E) : scotch transparent, papier collant, washi (rayé, pois, quadrillé, zigzag), aplats / éclaboussures / coups de pinceau / coulures de peinture, punaises, trombone, agrafe. Réglables : couleur, longueur du ruban ou taille, usure (jaunissement, plis, fissures, rouille, rayures), tirage. Double-clic sur un accessoire = on le modifie en direct (ou on le remplace par un autre modèle) ; ce sont des calques comme les autres (groupes, animation, boule…)
- Poignées sur le canvas pour tous les éléments : coins = taille proportionnelle, rond = rotation (Maj = pas de 15°)
- Projet : enregistrer (Ctrl+S) / ouvrir (Ctrl+O, ou glisser un fichier `.maxernzt`) / nouveau ; pastille jaune sur le bouton quand il y a des modifications non enregistrées, notification « Projet enregistré » (nom, calques, taille), notification jaune si le fichier a dû être téléchargé et rouge en cas d'échec, avertissement à la fermeture
- Annuler / rétablir (Ctrl+Z, Ctrl+Y ; 60 étapes) pour toutes les actions
- Format de la feuille : 16/9 (1920×1080), carré (1080×1080) ou 9/16 (1080×1920, par défaut), au choix dans la barre d'options ; les éléments restent centrés, le format est annulable et enregistré dans le projet
- Export vidéo de l'animation (icône pellicule) : durée (par défaut un cycle complet), 24/30/60 images par seconde, taille 100 % ou 50 % ; chaque image est rendue à l'instant exact i/fps (rendu identique sur toute machine) puis encodée en MP4 H.264, ou en WebM si le moteur n'a pas H.264 ; barre de progression et annulation
- Export PNG de la feuille, export des calques (PNG + `manifest.json` compatible Godot/animation)

## Timeline

Panneau en bas, que l'on étire vers le haut en tirant sa poignée (double-clic : replier ou déplier ; la hauteur est mémorisée, la feuille se recadre toute seule) : règle graduée, tête de lecture que l'on glisse, une ligne par élément ou groupe qui se déplie en cinq pistes : **Position, Rotation, Taille, Chiffonnage, Visibilité**. Les trajets dessinés apparaissent comme des clips, avec leurs pauses.

- **Enregistrement automatique** (point rouge) : place la tête de lecture, puis déplace, tourne (poignée ronde) ou agrandis (coins) l'élément sélectionné : l'image clé se crée seule à cet instant. La première image clé posée après 0 s ajoute un départ à la valeur de repos.
- Flèches « image clé précédente / suivante » (ou Alt+← / Alt+→) : la tête de lecture saute d'une image clé à l'autre pour la sélection, ou pour tous les éléments si rien n'est sélectionné.
- Image clé de pose (losange) : fixe position, rotation et taille à cet instant. Double-clic sur une piste : image clé à la valeur actuelle.
- Glisser un losange pour le décaler (pas de 0,05 s, Maj = libre) ; l'éditeur permet de saisir l'instant et la valeur au clavier, de choisir l'interpolation (constante, douce, palier) ou de supprimer (Suppr).
- Durée de la timeline : automatique ou saisie ; zoom au curseur ou Ctrl+molette. Tout est enregistré dans le projet, lu à l'export vidéo et dans le manifeste.

## Musique et danse automatique

- **Piste son** (icône note de la timeline, ou glisser un MP3 / WAV / OGG / M4A / FLAC sur la fenêtre) : une musique par projet, enregistrée **dans** le projet (40 Mo maximum), lue avec l'animation, affichée dans la timeline avec sa forme d'onde. La durée de la timeline prend celle de la musique.
- **Analyse du rythme** (`src/audio.ts`, traitement du signal, aucun modèle d'IA, tout en local) : séparation graves / aigus, courbes d'attaque, pics avec seuil adaptatif, tempo par autocorrélation, grille de temps calée sur les attaques. Trois jeux de repères : grosse caisse, temps, toutes les attaques ; réglage de sensibilité.
- **Danse automatique** (icône dé + note) : pose des effets tirés au hasard (rebondit, saute, battement, tremble, balancier, clignote, tour sur soi-même) sur les repères choisis, pour tous les éléments ou la sélection, selon une intensité et une amplitude (modulée par la force de chaque coup) ; « Danser ! » relance un autre tirage en remplaçant le précédent ; Ctrl+Z annule tout d'un coup.
- **Export vidéo avec le son** : AAC en MP4 (ou Opus en MP4 / WebM selon le navigateur) ; si aucun codec audio n'est disponible, l'export le signale et la vidéo est muette.

## Aimantation, verrouillage, effets

- **Aimantation** (icône aimant, à droite de la barre d'options, mémorisée) : en déplaçant, les bords et le centre de l'élément se collent à ceux de la feuille et des autres éléments (guides roses) ; la rotation se cale par crans de 15° ; dans la timeline, la tête de lecture et les images clés se collent aux autres images clés. Alt désactive l'aimantation le temps du geste.
- **Calques verrouillés** : cadenas dans le panneau des calques (éléments et groupes) ou Ctrl+L sur la sélection. Un élément verrouillé ne se sélectionne plus et ne bouge plus sur la feuille (les clics le traversent), mais il reste animé à la lecture ; l'état est enregistré dans le projet.
- **Effets prêts à l'emploi** (icône étincelles de la timeline) : apparition / disparition en fondu, surgit, s'évanouit, arrive en tournant, chute et rebonds, rebondit, battement, tremble, balancier, clignote. L'effet pose des images clés à partir de la tête de lecture, sur la durée choisie, pour la sélection ; elles restent modifiables une à une. La piste Visibilité gère maintenant une opacité continue (fondus).

## Effets de couleur

Icône palette dans la barre d'options (pour la sélection) : réglages rapides en un clic (noir et blanc, sépia, vieilli, photocopie, pop saturé, froid, négatif), puis luminosité, contraste, saturation, rotation de teinte, flou et voile coloré (couleur + intensité), avec retour à zéro. Les effets s'appliquent à l'image avant le contour : le bord blanc « papier » reste blanc ; ils sont annulables, enregistrés dans le projet, conservés par la duplication, et présents dans les exports PNG et vidéo.

## Textures de fond, banque d'images, enregistrement automatique

- **Texture du papier** (icône hachures, barre d'options) : lisse, papier grainé, kraft, carton, papier journal, cahier à carreaux, cahier à lignes, papier froissé, avec un curseur d'intensité. Choisir un papier propose aussi sa couleur de feuille (modifiable ensuite). Enregistrée dans le projet, annulable, visible dans les exports.
- **Banque d'images prédécoupées** (icône album, barre d'outils) : onglet *Formes* (étoile, cœur, flèche, éclair, explosion, bulle, disque, cible, croix, triangle, nuage, lune, bande de papier), insérées d'un clic comme éléments détourés ; onglet *Ma banque* : ajoute la sélection (avec ses effets de couleur) ou importe des PNG détourés ; elle est conservée sur l'ordinateur (IndexedDB) entre les sessions, et un clic insère l'image.
- **Enregistrement automatique** : toutes les 20 s (et quand la fenêtre passe en arrière-plan) un brouillon est gardé sur l'ordinateur tant qu'il y a des modifications non enregistrées (indication en bas à droite). Au lancement suivant, un bandeau propose de le restaurer ou de le supprimer ; un enregistrement normal efface le brouillon.

## Aide intégrée

Bouton **?** (en haut à droite) ou **F1** : une fenêtre d'aide avec la liste des sections à gauche et le contenu à droite, plus un champ de recherche qui filtre les sections et surligne le mot. Sections : prise en main, importer, détourer, ciseaux et déchirure, lettres, accessoires, banque d'images, calques / groupes / verrous, sélection et aimantation, effets de couleur, feuille (format, couleur, texture), animation (trajectoires), timeline et images clés, exports, projet / sauvegarde / brouillon, raccourcis clavier. Le contenu est dans `src/help.ts`. Le bouton « Visite guidée » de l'aide relance la visite.

## Visite guidée

Au premier lancement (sauf si un brouillon est à restaurer), une visite en 10 étapes présente les outils : importer, détourer, ciseaux et déchirure, lettres / accessoires / banque, calques, réglages, trajectoire, timeline, export. Navigation : Suivant / Précédent ou flèches et Entrée, Échap pour quitter ; case « Ne plus afficher au démarrage ». Elle se relance depuis l'aide (bouton « Visite guidée »).

## Animation

Outil trajectoire (P) : sélectionne un élément (ou un groupe dans le panneau), dessine le chemin à partir de lui ; le chemin est enregistré avec l'élément ou le groupe (les chemins s'additionnent le long de la hiérarchie). ▶ / Espace = lecture et pause, ■ / Échap = arrêt. Réglages : durée, boucle ou aller-retour, vitesse constante ou douce, orienter dans le sens du trajet, rotation continue (nombre de tours sur lui-même par cycle, négatif = sens inverse) ; le bouton flèche circulaire à gauche de la barre du bas fait tourner un élément ou un groupe sur place, sans trajectoire.

Images clés : en pause (ou en déplaçant la tête de lecture), ◆ ajoute une image clé à cet instant : l'élément s'y arrête (durée réglable), pivote pendant la pause (curseur ou poignée ronde sur le canvas) et peut, en option, se chiffonner en boule puis se déchiffonner à une image clé suivante (une image clé garde l'état précédent tant qu'on ne change pas le bouton boule/dépli) (la feuille se plie et s'enroule en 3D, avec ses plis éclairés, avant de devenir une boule de la taille proportionnelle, faite des couleurs de l'élément). Trajets, images clés, pauses, rotations et chiffonnage sont enregistrés dans le projet et dans le manifeste d'export.

## Interface

Boîte à outils à gauche (pictos, info-bulle = nom + raccourci), barre projet/historique/export en haut, barre d'options du calque dessous (contour, ombre, miroir, dupliquer, ordre, supprimer, tolérance, couleur de feuille, zoom), panneau de calques à droite (clic = sélectionner, glisser = réordonner), plan de travail en tapis de coupe.

Raccourcis : Ctrl+G grouper · Ctrl+Maj+G dissocier · Ctrl+A tout sélectionner · V déplacer · A détourage auto · C détourage au clic · B fond uni · X ciseaux · R déchirer · T lettres · [ ] ordre · 0 tout voir · Ctrl+D dupliquer · Ctrl+C/X/V copier, couper, coller · Ctrl+Z/Y · Ctrl+S/O · Suppr.

## Commandes souris

Clic : sélectionner/déplacer · Alt+molette : taille · Maj+molette : rotation · molette : zoom · clic milieu/droit : déplacer la vue

## Pistes

Tauri (installeur Windows), ONNX natif + DirectML, MobileSAM (clic pour choisir l'objet), timeline d'animation, packs d'images.

## Version en ligne (site + appli)

- `site/` : la vitrine statique (accueil avec vidéo d'intro, présentation, exemples, tutos dans `site/tutos/`, médias dans `site/media/`). Les exemples ouvrables dans l'appli sont dans `public/examples/*.maxernzt` (lien `app/?open=examples/nom.maxernzt`).
- La page d'accueil met en avant la musique : bandeau « NOUVEAU : avec du SON », macaron animé sur la vidéo d'intro et section `#son` avec une démo vidéo (`site/media/danse-son.mp4`, musique de synthèse créée pour le site) ; l'exemple correspondant (`public/examples/danse-sur-le-son.maxernzt`) embarque la musique.
- `npm run build:web` construit `dist-web/` : la vitrine à la racine et l'appli (chemins relatifs, polices libres embarquées, export des calques en .zip) dans `dist-web/app/`. Les modèles d'IA doivent être présents dans `public/models/`.
- Publication : workflow GitHub `Publier le site` (`.github/workflows/pages.yml`), se lance **à chaque push sur `main`** (ou à la main : Actions > Run workflow), une fois Settings > Pages > Source réglé sur « GitHub Actions ». Il télécharge lui-même les modèles d'IA.
- Aperçu local : `npm run build:web` puis `python -m http.server 8080 -d dist-web`, et ouvrir `http://localhost:8080/`.
- Les polices des lettres utilisent celle de Windows si elle est installée, sinon un équivalent libre (Anton, Gelasio, Tinos, Cousine, EB Garamond, Roboto Slab, Caveat, Barlow, Fira Sans, Archivo Black ; licence OFL).

## Installateur Windows

`npx tauri build` produit, en plus de l'exe, un installateur NSIS en français : `src-tauri/target/release/bundle/nsis/MaXernZt_0.18.2_x64-setup.exe`. Installation **par utilisateur** (sans droits administrateur) dans `%LocalAppData%\MaXernZt`, raccourcis dans le menu Démarrer, désinstallation depuis les paramètres Windows. Les modèles d'IA sont embarqués (≈ 43 Mo). Pour un simple exe sans installateur : `npx tauri build --no-bundle`. La version se règle dans `package.json`, `src-tauri/Cargo.toml` et `src-tauri/tauri.conf.json` (format x.y.z : 0.18.0 s'affiche « 0.18 » dans l'aide, section Crédits).

## Crédits

Conception : **Sébastien Sonet**. Développement : Claude (Anthropic), en collaboration avec le concepteur. IA embarquée : U²-Net (u2netp) et MobileSAM (Apache-2.0). Technologies : PixiJS, Tauri, ONNX Runtime Web, mp4-muxer / webm-muxer, Vite, TypeScript. Le détail se trouve dans l'aide (section « Crédits »).
