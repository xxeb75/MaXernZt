# MaXernZt

Atelier de collage : chaque morceau de papier est un calque indépendant (déplaçable, animable, exportable).

## Lancer

```bash
npm install
npm run dev      # http://localhost:5173
```

## Détourage IA (optionnel)

Place un modèle ONNX U²-Net dans `public/models/u2netp.onnx` (≈ 4,6 Mo, licence Apache 2.0, par ex. la version distribuée
avec le projet `rembg`). Sans lui, « Détourer (IA) » affiche un message ; « Détourer fond uni » fonctionne sans modèle.

## Détourage au clic (MobileSAM)

Fichiers ONNX à placer dans `public/models/` (Apache 2.0, dépôt Hugging Face `Acly/MobileSAM`) :
`mobile_sam_image_encoder.onnx` (≈ 28 Mo) et `sam_mask_decoder_single.onnx` (≈ 16,5 Mo).
Outil « Détourer au clic » : clic sur l'objet → aperçu ; Maj+clic ajoute une zone, Alt+clic en retire une ; Entrée découpe en nouveau calque, Échap annule.

## Outils actuels

- Import (bouton, glisser-déposer, Ctrl+V), détourage IA ou fond uni
- Ciseaux (tracé libre, bord irrégulier) et déchirure (ligne, bord fibreux, morceaux séparés)
- Contour blanc organique (épaisseur inégale, bord arraché, fibres ; curseur d'irrégularité), ombre réglable par calque, miroir, duplication, ordre
- Lettres découpées : mot sur un même papier ou une lettre par papier, choix de la police (ou mélange), des couleurs (préréglages, mélange ou personnalisées), bords coupés → déchirés, état neuf → crade, aperçu en direct et tirage (dé)
- Double-clic sur une lettre : le panneau s'ouvre avec son style et la modifie en direct (police, couleurs, bords, état, tirage, texte) ; le style est mémorisé dans le projet
- Groupes et sous-groupes (Ctrl+G / Ctrl+Maj+G) : sélection multiple (Maj+clic, cadre de sélection, Ctrl+A), déplacement/taille/rotation/miroir/duplication/ordre appliqués à tout le groupe, arbre repliable dans le panneau de calques (glisser-déposer pour ranger, double-clic pour renommer), hiérarchie conservée dans le projet et dans le manifeste d'export. Clic = tout le groupe, Ctrl+clic = un seul calque
- Poignées sur le canvas pour tous les éléments : coins = taille proportionnelle, rond = rotation (Maj = pas de 15°)
- Projet : enregistrer (Ctrl+S) / ouvrir (Ctrl+O, ou glisser un fichier `.maxernzt`) / nouveau ; avertissement si modifications non enregistrées
- Annuler / rétablir (Ctrl+Z, Ctrl+Y ; 60 étapes) pour toutes les actions
- Export PNG de la feuille, export des calques (PNG + `manifest.json` compatible Godot/animation)

## Interface

Boîte à outils à gauche (pictos, info-bulle = nom + raccourci), barre projet/historique/export en haut, barre d'options du calque dessous (contour, ombre, miroir, dupliquer, ordre, supprimer, tolérance, couleur de feuille, zoom), panneau de calques à droite (clic = sélectionner, glisser = réordonner), plan de travail en tapis de coupe.

Raccourcis : Ctrl+G grouper · Ctrl+Maj+G dissocier · Ctrl+A tout sélectionner · V déplacer · A détourage auto · C détourage au clic · B fond uni · X ciseaux · R déchirer · T lettres · [ ] ordre · 0 tout voir · Ctrl+D dupliquer · Ctrl+Z/Y · Ctrl+S/O · Suppr.

## Commandes souris

Clic : sélectionner/déplacer · Alt+molette : taille · Maj+molette : rotation · molette : zoom · clic milieu/droit : déplacer la vue

## Pistes

Tauri (installeur Windows), ONNX natif + DirectML, MobileSAM (clic pour choisir l'objet), timeline d'animation, packs d'images.
