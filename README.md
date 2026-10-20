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
- Export PNG de la feuille, export des calques (PNG + `manifest.json` compatible Godot/animation)

## Animation

Outil trajectoire (P) : sélectionne un élément (ou un groupe dans le panneau), dessine le chemin à partir de lui ; le chemin est enregistré avec l'élément ou le groupe (les chemins s'additionnent le long de la hiérarchie). ▶ / Espace = lecture et pause, ■ / Échap = arrêt. Réglages : durée, boucle ou aller-retour, vitesse constante ou douce, orienter dans le sens du trajet.

Images clés : en pause (ou en déplaçant la tête de lecture), ◆ ajoute une image clé à cet instant : l'élément s'y arrête (durée réglable), pivote pendant la pause (curseur ou poignée ronde sur le canvas) et peut, en option, se chiffonner en boule puis se déchiffonner à une image clé suivante (une image clé garde l'état précédent tant qu'on ne change pas le bouton boule/dépli) (la feuille se plie et s'enroule en 3D, avec ses plis éclairés, avant de devenir une boule de la taille proportionnelle, faite des couleurs de l'élément). Trajets, images clés, pauses, rotations et chiffonnage sont enregistrés dans le projet et dans le manifeste d'export.

## Interface

Boîte à outils à gauche (pictos, info-bulle = nom + raccourci), barre projet/historique/export en haut, barre d'options du calque dessous (contour, ombre, miroir, dupliquer, ordre, supprimer, tolérance, couleur de feuille, zoom), panneau de calques à droite (clic = sélectionner, glisser = réordonner), plan de travail en tapis de coupe.

Raccourcis : Ctrl+G grouper · Ctrl+Maj+G dissocier · Ctrl+A tout sélectionner · V déplacer · A détourage auto · C détourage au clic · B fond uni · X ciseaux · R déchirer · T lettres · [ ] ordre · 0 tout voir · Ctrl+D dupliquer · Ctrl+Z/Y · Ctrl+S/O · Suppr.

## Commandes souris

Clic : sélectionner/déplacer · Alt+molette : taille · Maj+molette : rotation · molette : zoom · clic milieu/droit : déplacer la vue

## Pistes

Tauri (installeur Windows), ONNX natif + DirectML, MobileSAM (clic pour choisir l'objet), timeline d'animation, packs d'images.
