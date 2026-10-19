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
- Bord blanc et ombre réglables par calque, miroir, duplication, ordre
- Lettres découpées : saisir un mot → une lettre = un calque, police/papier aléatoires
- Projet : enregistrer (Ctrl+S) / ouvrir (Ctrl+O, ou glisser un fichier `.maxernzt`) / nouveau ; avertissement si modifications non enregistrées
- Annuler / rétablir (Ctrl+Z, Ctrl+Y ; 60 étapes) pour toutes les actions
- Export PNG de la feuille, export des calques (PNG + `manifest.json` compatible Godot/animation)

## Commandes souris

Clic : sélectionner/déplacer · Alt+molette : taille · Maj+molette : rotation · molette : zoom · clic milieu/droit : déplacer la vue · Suppr : effacer

## Pistes

Tauri (installeur Windows), ONNX natif + DirectML, MobileSAM (clic pour choisir l'objet), timeline d'animation, packs d'images.
