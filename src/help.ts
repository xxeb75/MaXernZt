// Contenu de l'aide : une section par domaine de l'application. Les petites icônes (<i>) reprennent celles des boutons.
const ic = (id: string) => `<svg class="ic inl"><use href="#i-${id}"/></svg>`;
const k = (t: string) => `<kbd>${t}</kbd>`;

export interface HelpSection { id: string; title: string; icon: string; html: string }

export const HELP: HelpSection[] = [
  {
    id: 'start', title: 'Prise en main', icon: 'help', html: `
    <p>MaXernZt sert à composer des <b>collages en papier découpé</b> puis à les <b>animer</b>. Tout est fait d'éléments indépendants (des « calques ») posés sur une feuille.</p>
    <h4>Le principe en 5 gestes</h4>
    <ol>
      <li><b>Importer</b> des images (${ic('import')}, glisser-déposer ou ${k('Ctrl')}+${k('V')}).</li>
      <li><b>Détourer</b> ce qu'on garde (${ic('auto')} IA, ${ic('pick')} au clic) et lui donner un contour de papier.</li>
      <li><b>Composer</b> : déplacer, tourner, agrandir, grouper, ajouter lettres, scotch, formes de la banque.</li>
      <li><b>Animer</b> : tracer des trajectoires (${ic('path')}) et poser des images clés dans la timeline.</li>
      <li><b>Exporter</b> : vidéo, image PNG ou calques séparés (${ic('film')}), puis enregistrer le projet (${ic('save')}).</li>
    </ol>
    <h4>Disposition de l'écran</h4>
    <ul>
      <li><b>À gauche</b> : les outils. <b>En haut</b> : fichier, annuler / rétablir, aide et exports ; juste dessous, la barre d'options de la sélection et de la feuille.</li>
      <li><b>Au centre</b> : la feuille. <b>À droite</b> : le panneau des calques et des groupes.</li>
      <li><b>En bas</b> : la timeline et, dessous, la barre d'animation de l'élément sélectionné.</li>
    </ul>
    <p><b>Version en ligne ou Windows</b> : les deux font la même chose ; la version Windows enregistre directement dans le fichier choisi et exporte dans un dossier, la version en ligne passe par le navigateur (Chrome ou Edge recommandés) et télécharge les fichiers. Si l'écran est étroit, la barre d'options passe sur deux lignes.</p>
    <p>Passe la souris sur n'importe quel bouton : une infobulle donne son nom et son raccourci. La <b>visite guidée</b> se relance depuis le bouton en haut de cette fenêtre.</p>` },
  {
    id: 'import', title: 'Importer des images', icon: 'import', html: `
    <ul>
      <li>${ic('import')} ouvre un sélecteur ; on peut aussi <b>glisser-déposer</b> des fichiers sur la fenêtre ou <b>coller</b> une image avec ${k('Ctrl')}+${k('V')}.</li>
      <li>Les images sont réduites à 1 200 px de côté maximum et arrivent au centre de la feuille.</li>
      <li>Un fichier <b>.maxernzt</b> glissé sur la fenêtre ouvre le projet ; un fichier son (MP3, WAV…) devient la musique du projet.</li>
      <li>Sur le site, les <b>exemples</b> s'ouvrent directement dans l'application ; ce sont des projets <b>.maxernzt</b> comme les tiens (enregistre-les sous un autre nom avant de les modifier). L'exemple « Danse sur le son » contient une musique : appuie sur ▶ pour l'entendre, puis sur le dé pour refaire une danse.</li>
      <li>Une image déjà <b>détourée</b> (PNG transparent) est prête à l'emploi ; sinon utilise les outils de détourage.</li>
    </ul>` },
  {
    id: 'cutout', title: 'Détourer', icon: 'auto', html: `
    <h4>${ic('auto')} Détourage automatique ${k('A')}</h4>
    <p>L'IA, qui tourne sur ton ordinateur sans internet, isole l'objet principal de l'image sélectionnée.</p>
    <h4>${ic('pick')} Détourage au clic ${k('C')}</h4>
    <ul>
      <li>Clique sur l'élément à détourer : un aperçu de la zone détectée s'affiche. ${k('Maj')}+clic <b>ajoute</b> une zone, ${k('Alt')}+clic en <b>retire</b> une.</li>
      <li>${k('Entrée')} valide et découpe, ${k('Échap')} annule.</li>
    </ul>
    <h4>${ic('eraser')} Effacer le fond uni ${k('B')}</h4>
    <p>Clique le fond (blanc, ciel…) : les pixels de couleur proche disparaissent. La <b>tolérance</b> se règle dans la barre d'options ; ${ic('scrap')} jette ensuite la plus petite part si le fond a coupé l'image en morceaux.</p>
    <h4>Contour papier</h4>
    <p>Dans la barre d'options : <b>contour blanc</b> (épaisseur), <b>contour irrégulier</b> (de net à très arraché) et <b>ombre</b>. Ces réglages s'appliquent à tous les éléments sélectionnés.</p>` },
  {
    id: 'cut', title: 'Ciseaux et déchirure', icon: 'tear', html: `
    <h4>${ic('scissors')} Ciseaux ${k('X')}</h4>
    <p>Sélectionne d'abord une image, puis trace à main levée le contour à découper : la zone tracée devient un <b>morceau</b> séparé que tu peux déplacer.</p>
    <h4>${ic('tear')} Déchirer ${k('R')}</h4>
    <p>Sélectionne une image puis trace une ligne <b>à travers</b> elle : elle se déchire en deux en suivant ton geste, avec un bord blanc irrégulier comme du vrai papier. La plus petite part est sélectionnée.</p>
    <h4>${ic('scrap')} Jeter la chute</h4>
    <p>Le bouton de la barre d'options, quand il est actif, supprime automatiquement la plus petite part après une découpe, pour enchaîner plusieurs coupes. ${k('Échap')} quitte l'outil.</p>` },
  {
    id: 'letters', title: 'Lettres découpées', icon: 'letter', html: `
    <p>${ic('letter')} ${k('T')} compose un mot en lettres découpées, comme dans les collages de journaux.</p>
    <ul>
      <li><b>Mode</b> : lettres <b>sur un même papier</b>, ou <b>une lettre par papier</b> (chaque lettre est un élément, pour les animer une à une).</li>
      <li>Tape le mot, l'aperçu se met à jour ; ${k('Entrée')} l'ajoute à la feuille.</li>
      <li><b>Typographie</b> : une police par lettre au hasard ou une police unique.</li>
      <li><b>Couleurs</b> : palettes de papier et d'encre, ou couleurs choisies à la main.</li>
      <li><b>Déchirure</b> des bords et <b>état</b> du papier, du plus propre au plus sale (taches, usure).</li>
      <li><b>Autre tirage</b> (dé) : relance le hasard pour obtenir une variante.</li>
    </ul>
    <p><b>Modifier</b> un mot déjà posé : double-clique sur une de ses lettres. Les réglages se rouvrent, et le mot est remplacé à sa place.</p>` },
  {
    id: 'acc', title: 'Accessoires', icon: 'acc', html: `
    <p>${ic('acc')} ${k('E')} ajoute des éléments de décor, réglables, qui se comportent comme n'importe quel calque.</p>
    <ul>
      <li><b>Scotch et rubans</b> : plusieurs motifs, une <b>longueur</b> réglable.</li>
      <li><b>Peinture</b> : aplats et taches. <b>Punaises</b>. <b>Trombones et agrafes</b> (taille réglable).</li>
      <li><b>Couleur</b> (pastilles ou couleur libre) et <b>état</b> du neuf à l'abîmé (jaunissement, taches, plis, rouille selon la matière).</li>
      <li><b>Autre tirage</b> (dé) : une variante au hasard.</li>
    </ul>
    <p>Règle couleur, longueur et état, puis clique un modèle : il est ajouté à la feuille. <b>Double-clic</b> sur un accessoire posé : on rouvre ses réglages, et un clic sur un autre modèle le remplace en direct.</p>` },
  {
    id: 'bank', title: 'Banque d\'images', icon: 'bank', html: `
    <p>${ic('bank')} ouvre la banque d'images prédécoupées.</p>
    <ul>
      <li>Onglet ${ic('star')} <b>Formes</b> : étoile, cœur, flèche, éclair, explosion, bulle, disque, cible, croix, triangle, nuage, lune, bande de papier. Un clic l'ajoute à la feuille comme un élément détouré.</li>
      <li>Onglet ${ic('bank')} <b>Ma banque</b> : tes propres images détourées, conservées sur l'ordinateur d'une session à l'autre.
        <ul>
          <li>${ic('bankadd')} <b>ajoute la sélection</b> à ta banque (avec ses effets de couleur) ;</li>
          <li>${ic('import')} <b>importe</b> des images (idéalement des PNG détourés) ;</li>
          <li>un clic sur une vignette l'insère ; la corbeille, au survol, la retire de la banque.</li>
        </ul>
      </li>
    </ul>
    <p>Astuce : les couleurs d'une forme se changent ensuite avec les <b>effets de couleur</b>.</p>` },
  {
    id: 'layers', title: 'Calques, groupes et verrous', icon: 'grp', html: `
    <h4>Le panneau de droite</h4>
    <ul>
      <li>La liste va de l'avant (en haut) vers l'arrière. <b>Glisse</b> une ligne pour changer l'ordre, ou sur un groupe pour y ranger l'élément.</li>
      <li>${ic('eye')} masque ou affiche. ${ic('lock')} <b>verrouille</b> : l'élément ne se sélectionne plus et ne bouge plus sur la feuille (les clics le traversent), mais il reste animé. ${ic('dup')} duplique.</li>
      <li><b>Double-clic</b> sur un nom : renommer. La flèche plie ou déplie un groupe.</li>
    </ul>
    <h4>Groupes et sous-groupes</h4>
    <ul>
      <li>${ic('grp')} ${k('Ctrl')}+${k('G')} groupe la sélection, ${ic('ungrp')} ${k('Ctrl')}+${k('Maj')}+${k('G')} dissocie.</li>
      <li>Sur la feuille, un clic sélectionne <b>un élément</b>. Pour sélectionner <b>tout un groupe</b>, clique-le dans le panneau.</li>
      <li>Un groupe peut avoir sa propre trajectoire et ses images clés : tout le groupe bouge ensemble.</li>
    </ul>
    <h4>Autres actions (barre d'options)</h4>
    <ul>
      <li><b>Copier / couper / coller</b> : ${k('Ctrl')}+${k('C')}, ${k('Ctrl')}+${k('X')}, ${k('Ctrl')}+${k('V')} sur la sélection (éléments ou groupes entiers, avec leurs réglages, effets, trajets et images clés). Chaque collage se décale un peu et devient la sélection ; on peut coller plusieurs fois, et aussi après avoir coupé. Une image copiée depuis une autre application est importée à la place.</li>
      <li>${ic('flip')} miroir, ${ic('front')} avancer ${k(']')}, ${ic('back')} reculer ${k('[')}, ${ic('dup')} dupliquer ${k('Ctrl')}+${k('D')}, ${ic('lock')} verrouiller ${k('Ctrl')}+${k('L')}, ${ic('trash')} supprimer ${k('Suppr')}.</li>
    </ul>` },
  {
    id: 'select', title: 'Sélection, déplacement, aimantation', icon: 'select', html: `
    <h4>Sélectionner ${k('V')}</h4>
    <ul>
      <li><b>Clic</b> : un élément. ${k('Maj')}+clic : ajouter ou retirer. <b>Glisser dans le vide</b> : sélection par cadre. ${k('Ctrl')}+${k('A')} : tout.</li>
    </ul>
    <h4>Transformer</h4>
    <ul>
      <li><b>Déplacer</b> : glisse l'élément. <b>Taille</b> : les coins du cadre (proportionnelle). <b>Rotation</b> : la poignée ronde au-dessus ; ${k('Maj')} cale par crans de 15°.</li>
      <li>À la molette : ${k('Alt')}+molette change la taille de la sélection, ${k('Maj')}+molette la fait tourner.</li>
    </ul>
    <h4>${ic('snap')} Aimantation</h4>
    <p>Quand elle est active (bouton à droite de la barre d'options), les bords et le centre de l'élément se collent à ceux de la feuille et des autres éléments, avec des guides roses ; la rotation se cale tous les 15°. Dans la timeline, la tête de lecture et les images clés se collent aussi aux autres images clés. ${k('Alt')} la désactive le temps d'un geste.</p>
    <h4>Vue</h4>
    <ul>
      <li><b>Molette</b> : zoom. <b>Clic droit ou molette enfoncée + glisser</b> : déplacer la vue. ${ic('fit')} ou ${k('0')} : tout voir.</li>
      <li>Quand tu agrandis la timeline avec la vue zoomée, le centre de ce que tu regardes est conservé.</li>
    </ul>` },
  {
    id: 'color', title: 'Effets de couleur', icon: 'pal', html: `
    <p>${ic('pal')} (barre d'options) transforme les couleurs de la sélection, en direct.</p>
    <ul>
      <li><b>Réglages rapides</b> : noir et blanc, sépia, vieilli, photocopie, pop saturé, froid, négatif.</li>
      <li><b>Curseurs</b> : ${ic('sun')} luminosité, ${ic('contrast')} contraste, ${ic('sat')} saturation, ${ic('hue')} teinte (rotation des couleurs), ${ic('blur')} flou.</li>
      <li><b>Voile coloré</b> : une couleur et son intensité, mélangée par-dessus l'élément.</li>
      <li>${ic('undo')} remet tout à zéro.</li>
    </ul>
    <p>Le contour blanc « papier » et l'ombre ne sont pas touchés. L'effet est annulable, enregistré dans le projet, conservé par la duplication, et présent dans les exports.</p>` },
  {
    id: 'paper', title: 'Feuille : format, couleur, texture', icon: 'ptex', html: `
    <ul>
      <li><b>Format</b> (barre d'options, à droite) : 16/9 (1920×1080), carré (1080×1080) ou 9/16 (1080×1920). Les éléments restent centrés ; le changement est annulable.</li>
      <li>${ic('drop')} <b>Couleur de la feuille</b>.</li>
      <li>${ic('ptex')} <b>Texture du papier</b> : lisse, papier grainé, kraft, carton, papier journal, cahier à carreaux, cahier à lignes, papier froissé. Un curseur règle l'intensité. Choisir un papier propose sa couleur habituelle, que tu peux modifier.</li>
    </ul>
    <p>Le format, la couleur et la texture sont enregistrés avec le projet et visibles dans l'export de la feuille et de la vidéo.</p>` },
  {
    id: 'anim', title: 'Animation : trajectoires', icon: 'path', html: `
    <p>Chaque élément (ou groupe) peut avoir <b>un trajet</b> qu'il parcourt en boucle.</p>
    <h4>${ic('path')} Dessiner un trajet ${k('P')}</h4>
    <ol>
      <li>Sélectionne un élément ou, dans le panneau, un groupe.</li>
      <li>Trace le chemin à main levée à partir de lui ; il est lissé automatiquement.</li>
      <li>${ic('play')} ou ${k('Espace')} lance la lecture et la met en pause, ${ic('stop')} ou ${k('Échap')} l'arrête.</li>
    </ol>
    <p>Les trajets d'un groupe et de ses éléments <b>s'additionnent</b>.</p>
    <h4>Barre d'animation (en bas)</h4>
    <ul>
      <li><b>Durée</b> d'un cycle ; <b>boucle</b> ou <b>aller-retour</b> ; vitesse <b>constante</b> ou <b>douce</b> ; <b>orienter</b> l'élément dans le sens du trajet.</li>
      <li><b>Rotation continue</b> : nombre de tours sur lui-même par cycle (négatif = sens inverse). Le bouton flèche circulaire à gauche fait tourner un élément <b>sur place</b>, sans trajet.</li>
      <li><b>Pauses</b> : ajoute une pause à un point du trajet, avec une durée, une rotation sur place et, au choix, un <b>chiffonnage en boule</b> ou un déchiffonnage (le papier se plie réellement avant de devenir boule).</li>
      <li>Toutes les valeurs numériques se saisissent aussi au clavier.</li>
    </ul>` },
  {
    id: 'timeline', title: 'Timeline et images clés', icon: 'clock', html: `
    <h4>Lire la timeline</h4>
    <ul>
      <li>La <b>règle</b> graduée porte la <b>tête de lecture</b> (rouge) : clique ou glisse sur la règle pour te placer à un instant. Les valeurs de la feuille se mettent à jour.</li>
      <li>Une ligne par élément ou groupe, qui se déplie en cinq pistes : <b>Position, Rotation, Taille, Chiffonnage, Visibilité</b> (opacité). Les trajets dessinés apparaissent comme des clips avec leurs pauses.</li>
      <li>${ic('clock')} champ de l'instant : on peut saisir l'heure au clavier.</li>
    </ul>
    <h4>Créer des images clés</h4>
    <ul>
      <li>${ic('rec')} <b>enregistrement automatique</b> : place la tête de lecture, puis <b>déplace, tourne ou agrandis</b> l'élément sélectionné : une image clé se crée seule à cet instant.</li>
      <li>${ic('key')} <b>image clé de pose</b> : fixe position, rotation et taille à cet instant. <b>Double-clic</b> sur une piste : image clé à la valeur actuelle.</li>
      <li>${ic('fx')} <b>effets prêts à l'emploi</b> : apparition ou disparition en fondu, surgit, s'évanouit, arrive en tournant, chute et rebonds, rebondit, battement, tremble, balancier, clignote, tour sur soi-même, saute. Choisis la <b>durée</b> avec le curseur ; l'effet pose ses images clés à partir de la tête de lecture, pour toute la sélection.</li>
    </ul>
    <h4>Naviguer et modifier</h4>
    <ul>
      <li>${ic('kprev')} ${ic('knext')} <b>image clé précédente / suivante</b> (${k('Alt')}+${k('←')} / ${k('Alt')}+${k('→')}) : saute d'une clé à l'autre pour la sélection, ou pour tous les éléments si rien n'est sélectionné.</li>
      <li><b>Glisse</b> un losange pour le décaler (pas de 0,05 s ; ${k('Maj')} = libre ; il se colle aux autres clés).</li>
      <li>Un losange sélectionné s'édite : instant, valeur au clavier, <b>interpolation</b> vers la clé suivante (constante, douce, palier) ; ${k('Suppr')} le supprime.</li>
      <li>Le <b>curseur de zoom</b> (ou ${k('Ctrl')}+molette) agrandit l'échelle de temps.</li>
    </ul>
    <h4>Taille et durée</h4>
    <ul>
      <li><b>Étire le panneau vers le haut</b> en tirant la poignée au-dessus ; double-clic dessus (ou ${ic('chev')}) : replier / déplier. La hauteur est mémorisée.</li>
      <li>La <b>durée</b> est automatique (au moins 5 s, jusqu'à la dernière clé ou au plus long trajet) ou saisie à la main.</li>
    </ul>` },
  {
    id: 'music', title: 'Musique et danse automatique', icon: 'note', html: `
    <p>Un projet peut avoir <b>une musique</b>. Elle se lit avec l'animation, apparaît dans la timeline avec sa forme d'onde et ses repères, et peut servir à faire <b>danser le collage</b> sur le rythme.</p>
    <h4>${ic('note')} Charger une musique</h4>
    <ul>
      <li>Clique l'icône note de la timeline et choisis un fichier (MP3, WAV, OGG, M4A, FLAC…), ou glisse-le sur la fenêtre. Au-delà de 40 Mo, il est refusé : le son est enregistré <b>dans le projet</b>.</li>
      <li>La durée de la timeline prend celle de la musique (tu peux la modifier ensuite).</li>
      <li>La musique se lit avec ▶ / <kbd>Espace</kbd> et se met en pause avec l'animation. Dans l'export vidéo, elle est ajoutée à la vidéo (AAC en MP4, Opus en WebM), sauf si elle est coupée.</li>
    </ul>
    <h4>Analyse du rythme</h4>
    <p>Dès le chargement, l'application analyse le son (traitement du signal, sans envoi sur internet) : elle sépare les <b>graves</b> (grosse caisse) des <b>aigus</b> (caisse claire, charleston), repère les <b>pics</b>, estime le <b>tempo</b> en battements par minute et cale une <b>grille de temps</b> régulière. Les repères jaunes de la piste montrent les temps retenus ; l'icône note rouvre les réglages :</p>
    <ul>
      <li><b>Volume</b> et <b>coupure</b> du son (lecture et export) ; <b>sensibilité</b> de la détection (plus haut = plus de pics retenus) ; choisir une autre musique ; retirer la musique.</li>
      <li>Le panneau indique le tempo et le nombre de coups détectés. Si le tempo est faux (morceau très syncopé), choisis « Grosse caisse » ou « Attaques » comme repères plutôt que « Temps ».</li>
    </ul>
    <h4>${ic('dance')} Danse automatique</h4>
    <p>L'icône dé + note pose, en un clic, des <b>effets tirés au hasard</b> sur les repères de la musique, puis lance la lecture : le collage danse.</p>
    <ul>
      <li><b>Repères</b> : grosse caisse, temps (grille du tempo) ou toutes les attaques.</li>
      <li><b>Cible</b> : tous les éléments de la feuille (hors éléments verrouillés), ou seulement la sélection. Les éléments réagissent chacun leur tour, sans se chevaucher.</li>
      <li><b>Effets possibles</b> : rebondit, saute, battement, tremble, balancier, clignote, tour sur soi-même. Clique une icône pour la retirer ou la remettre.</li>
      <li><b>Intensité</b> (1 à 10) : part des éléments qui réagissent à chaque coup (à 10, tous bougent ensemble) et part des coups utilisée.</li>
      <li><b>Amplitude</b> (1 à 10) : ampleur des mouvements. Elle est modulée par la force du coup : un gros coup de grosse caisse fait bouger plus fort qu'un coup léger.</li>
      <li><b>Danser !</b> pose les effets ; recliquer donne <b>un autre tirage</b> en remplaçant le précédent. <kbd>Ctrl</kbd>+<kbd>Z</kbd> annule toute la danse d'un coup.</li>
    </ul>
    <p>Ce sont des images clés ordinaires : tu peux ensuite les déplacer, les modifier ou les supprimer dans la timeline, ou ajouter tes propres effets par-dessus.</p>` },
  {
    id: 'export', title: 'Exporter la vidéo et les images', icon: 'film', html: `
    <h4>${ic('film')} Vidéo</h4>
    <ul>
      <li>Choisis la <b>durée</b> (par défaut un cycle complet), la fréquence (<b>24, 30 ou 60 images/s</b>) et la taille (<b>100 %</b> ou <b>50 %</b>).</li>
      <li>Chaque image est calculée à l'instant exact, puis encodée en <b>MP4 H.264</b> (ou WebM si H.264 n'est pas disponible). Une barre de progression permet d'annuler.</li>
      <li>Si le projet a une <b>musique</b> (voir « Musique et danse automatique »), elle est ajoutée à la vidéo (AAC en MP4, Opus en WebM). Si le navigateur ne sait pas encoder le son, l'export le signale et la vidéo est muette.</li>
    </ul>
    <h4>${ic('png')} Image PNG</h4>
    <p>Exporte la feuille telle qu'elle est (fond et texture compris).</p>
    <h4>${ic('layers-out')} Calques PNG + manifeste</h4>
    <p>Dans l'application Windows, choisis un dossier : un PNG par élément (avec contour et effets) est écrit dans <code>…_calques/layers</code>, avec un <code>manifest.json</code> (position, rotation, échelle, ordre, groupe, trajets et images clés) utilisable dans un moteur de jeu ou d'animation. <b>Dans le navigateur</b>, tout est regroupé dans un seul fichier <code>…_calques.zip</code> (dossier <code>layers/</code> + <code>manifest.json</code>).</p>` },
  {
    id: 'project', title: 'Projet, sauvegarde et brouillon', icon: 'save', html: `
    <ul>
      <li>${ic('new')} nouvelle feuille. ${ic('open')} ${k('Ctrl')}+${k('O')} ouvre un projet <b>.maxernzt</b>.</li>
      <li>${ic('save')} ${k('Ctrl')}+${k('S')} <b>enregistre</b> : la première fois on choisit l'emplacement, ensuite le même fichier est réécrit sans fenêtre. Une pastille signale les modifications non enregistrées ; une notification confirme chaque enregistrement.</li>
      <li>${ic('saveas')} ${k('Ctrl')}+${k('Maj')}+${k('S')} <b>enregistre sous…</b> et demande toujours où.</li>
      <li>${ic('undo')} ${ic('redo')} ${k('Ctrl')}+${k('Z')} / ${k('Ctrl')}+${k('Y')} : annuler et rétablir (60 niveaux).</li>
    </ul>
    <h4>Enregistrement automatique</h4>
    <p>La musique est enregistrée avec le projet (le fichier grossit d'autant). Toutes les 20 secondes, et quand la fenêtre passe en arrière-plan, un <b>brouillon</b> est gardé sur l'ordinateur tant qu'il y a des modifications non enregistrées (indication en bas à droite). Au lancement suivant, un bandeau propose de le <b>restaurer</b> ou de le supprimer. Il ne remplace jamais ton fichier ; un enregistrement normal l'efface.</p>` },
  {
    id: 'keys', title: 'Raccourcis clavier', icon: 'key', html: `
    <table class="keys">
      <tr><th colspan="2">Outils</th></tr>
      <tr><td>${k('V')}</td><td>Sélectionner / déplacer</td></tr>
      <tr><td>${k('A')}</td><td>Détourage automatique</td></tr>
      <tr><td>${k('C')}</td><td>Détourage au clic</td></tr>
      <tr><td>${k('B')}</td><td>Effacer le fond uni</td></tr>
      <tr><td>${k('X')}</td><td>Ciseaux</td></tr>
      <tr><td>${k('R')}</td><td>Déchirer</td></tr>
      <tr><td>${k('T')}</td><td>Lettres découpées</td></tr>
      <tr><td>${k('E')}</td><td>Accessoires</td></tr>
      <tr><td>${k('P')}</td><td>Trajectoire</td></tr>
      <tr><th colspan="2">Édition</th></tr>
      <tr><td>${k('Ctrl')}+${k('Z')} / ${k('Ctrl')}+${k('Y')}</td><td>Annuler / rétablir</td></tr>
      <tr><td>${k('Ctrl')}+${k('A')}</td><td>Tout sélectionner</td></tr>
      <tr><td>${k('Ctrl')}+${k('D')}</td><td>Dupliquer</td></tr>
      <tr><td>${k('Ctrl')}+${k('C')} / ${k('Ctrl')}+${k('X')} / ${k('Ctrl')}+${k('V')}</td><td>Copier / couper / coller des éléments (ou coller une image)</td></tr>
      <tr><td>${k('Ctrl')}+${k('G')} / ${k('Ctrl')}+${k('Maj')}+${k('G')}</td><td>Grouper / dissocier</td></tr>
      <tr><td>${k('Ctrl')}+${k('L')}</td><td>Verrouiller la sélection</td></tr>
      <tr><td>${k(']')} / ${k('[')}</td><td>Avancer / reculer</td></tr>
      <tr><td>${k('Suppr')}</td><td>Supprimer (la clé sélectionnée dans la timeline, sinon la sélection)</td></tr>
      <tr><td>${k('Maj')}</td><td>Ajouter à la sélection ; rotation par crans de 15°</td></tr>
      <tr><td>${k('Alt')}</td><td>Ignorer l'aimantation le temps d'un geste</td></tr>
      <tr><th colspan="2">Vue et lecture</th></tr>
      <tr><td>${k('0')}</td><td>Tout voir</td></tr>
      <tr><td>Molette</td><td>Zoom ; ${k('Alt')}+molette : taille ; ${k('Maj')}+molette : rotation</td></tr>
      <tr><td>${k('Espace')}</td><td>Lecture / pause</td></tr>
      <tr><td>${k('Échap')}</td><td>Arrêter la lecture, annuler l'outil en cours</td></tr>
      <tr><td>${k('Alt')}+${k('←')} / ${k('Alt')}+${k('→')}</td><td>Image clé précédente / suivante</td></tr>
      <tr><th colspan="2">Fichier</th></tr>
      <tr><td>${k('Ctrl')}+${k('S')}</td><td>Enregistrer</td></tr>
      <tr><td>${k('Ctrl')}+${k('Maj')}+${k('S')}</td><td>Enregistrer sous…</td></tr>
      <tr><td>${k('Ctrl')}+${k('O')}</td><td>Ouvrir</td></tr>
      <tr><td>${k('F1')}</td><td>Cette aide</td></tr>
    </table>` },
  {
    id: 'credits', title: 'Crédits', icon: 'logo', html: `
    <div class="credits-head">
      <svg class="mark" viewBox="0 0 28 28" aria-hidden="true"><path d="M3 6.5 7 4.6l4 1.7 4-1.8 4 1.7 5-1.6.6 18.6L4.4 25.6z" fill="#f2b134"/><path d="M8.4 20.2v-9.6l5.6 6 5.6-6v9.6" fill="none" stroke="#1d1f23" stroke-width="3.1" stroke-linejoin="round" stroke-linecap="round"/></svg>
      <div><div class="credits-name">Ma<b>X</b>ernZt</div><div class="credits-sub">Collage en papier découpé et animation · version ${__APP_VERSION__}</div></div>
    </div>
    <h4>Conception</h4>
    <table class="credits"><tr><td><b>Sébastien Sonet</b></td><td>Concepteur : idée, cahier des charges, direction artistique et essais.</td></tr></table>
    <h4>Développement</h4>
    <table class="credits"><tr><td><b>Claude</b> (Anthropic)</td><td>Programmation de l'application, réalisée en collaboration avec le concepteur.</td></tr></table>
    <h4>Intelligence artificielle embarquée (fonctionne sans internet)</h4>
    <table class="credits">
      <tr><td><b>U²-Net</b> (u2netp)</td><td>Détourage automatique. Xuebin Qin et al. ; modèle diffusé par le projet rembg. Licence Apache-2.0.</td></tr>
      <tr><td><b>MobileSAM</b></td><td>Détourage au clic. Chaoning Zhang et al., d'après Segment Anything (Meta AI). Licence Apache-2.0.</td></tr>
    </table>
    <h4>Technologies</h4>
    <table class="credits">
      <tr><td><b>PixiJS</b></td><td>Affichage 2D accéléré de la feuille. Licence MIT.</td></tr>
      <tr><td><b>Tauri</b></td><td>Application Windows native. Licences MIT / Apache-2.0.</td></tr>
      <tr><td><b>ONNX Runtime Web</b></td><td>Exécution des modèles d'IA dans l'application. Licence MIT.</td></tr>
      <tr><td><b>mp4-muxer</b>, <b>webm-muxer</b></td><td>Assemblage des fichiers vidéo exportés. Licence MIT.</td></tr>
      <tr><td><b>Vite</b>, <b>TypeScript</b></td><td>Outils de construction et langage du code. Licences MIT et Apache-2.0.</td></tr>
    </table>
    <h4>Polices des lettres découpées</h4>
    <p>Les lettres utilisent les polices installées sous Windows (Impact, Arial Black, Georgia, Times New Roman, Courier New, Palatino Linotype, Rockwell, Segoe Script, Bahnschrift, Trebuchet MS), qui appartiennent à leurs auteurs respectifs.</p>
    <p class="credits-foot">Les noms de projets cités appartiennent à leurs propriétaires. © Sébastien Sonet — tous droits réservés sur la conception de MaXernZt.</p>` },
];
