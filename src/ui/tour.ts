import { $ } from './dom';
import { kvGet } from '../bank';

// ---- visite guidée : s'ouvre au premier lancement, ensuite avec « ? » ou F1
export function initTour() {
  interface Step { sel: string | null; title: string; text: string }
  const STEPS: Step[] = [
    { sel: null, title: 'Bienvenue dans MaXernZt', text: "Compose des <b>collages en papier découpé</b> puis <b>anime-les</b> : chaque élément reste indépendant. Cette visite dure une minute ; tu peux la quitter à tout moment. Le bouton <b>?</b> (ou F1) ouvre l'<b>aide complète</b>, d'où l'on relance cette visite." },
    { sel: '#btn-import', title: 'Importer des images', text: "Clique ici, <b>glisse-dépose</b> des fichiers sur la feuille, ou colle une image avec <b>Ctrl+V</b>. Un projet <b>.maxernzt</b> glissé sur la fenêtre s'ouvre aussi." },
    { sel: '#btn-ai', title: 'Détourer', text: "<b>A</b> détoure automatiquement l'objet principal (IA locale, sans internet). <b>C</b> détoure au clic : clique ce que tu veux garder. La gomme <b>B</b> efface un fond uni." },
    { sel: '#btn-scissors', title: 'Ciseaux et déchirure', text: "<b>X</b> : trace une découpe aux ciseaux. <b>R</b> : déchire une feuille en suivant ton geste. Les contours deviennent irréguliers, comme du vrai papier." },
    { sel: '#btn-text', title: 'Lettres, accessoires, banque', text: "<b>T</b> compose des mots en lettres découpées. <b>E</b> ajoute scotch, peinture, punaises, trombones. L'album ouvre une <b>banque</b> de formes prêtes à l'emploi et ta propre banque d'images détourées." },
    { sel: '#layers', title: 'Éléments, groupes et verrous', text: "Un clic sélectionne, <b>Maj/Ctrl</b> ajoute. Glisse pour réordonner ou regrouper (<b>Ctrl+G</b>). L'œil masque, le <b>cadenas</b> verrouille, la copie duplique. Un groupe se sélectionne ici, pas sur la feuille." },
    { sel: '#opts', title: 'Réglages de la sélection', text: "Contour, déchirure, ombre ; <b>effets de couleur</b> (palette), verrou, suppression ; format de la feuille, <b>texture du papier</b>, couleur de fond, <b>aimantation</b> (Alt pour l'ignorer le temps d'un geste)." },
    { sel: '#btn-path', title: 'Animer : la trajectoire', text: "<b>P</b> : sélectionne un élément puis dessine son chemin à partir de lui. ▶ ou <b>Espace</b> lance la lecture, <b>Échap</b> l'arrête. La barre du bas règle durée, boucle, rotation et pauses." },
    { sel: '#timeline', title: 'La timeline', text: "Une piste par propriété : position, rotation, taille, chiffonnage, visibilité. Le <b>point rouge</b> enregistre tes gestes en images clés ; les <b>étincelles</b> posent des effets tout faits ; les flèches sautent d'une clé à l'autre. <b>Tire le haut du panneau</b> pour l'agrandir." },
    { sel: '#btn-video', title: 'Exporter et enregistrer', text: "La pellicule exporte la <b>vidéo</b> (MP4), les autres boutons l'image ou les calques. <b>Ctrl+S</b> enregistre (Ctrl+Maj+S : enregistrer sous) ; un brouillon est aussi gardé automatiquement et proposé au prochain lancement. Bonne création !" },
  ];
  const tourEl = $('tour'), hole = $('tour-hole'), card = $('tour-card');
  let i = 0;
  const place = () => {
    const s = STEPS[i], el = s.sel ? (document.querySelector(s.sel) as HTMLElement | null) : null;
    const W = innerWidth, H = innerHeight, cw = card.offsetWidth, ch = card.offsetHeight;
    if (el) {
      const r = el.getBoundingClientRect(), pad = 6;
      hole.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
      let x = r.right + 18, y = r.top + r.height / 2 - ch / 2;                         // à droite de l'élément
      if (x + cw > W - 12) { x = r.left + r.width / 2 - cw / 2; y = r.bottom + 18; }   // sinon dessous
      if (y + ch > H - 12) y = r.top - ch - 18;                                        // sinon dessus
      if (y < 12) y = Math.max(12, Math.min(H - ch - 12, r.top + 12));
      card.style.left = Math.max(12, Math.min(x, W - cw - 12)) + 'px'; card.style.top = Math.max(12, Math.min(y, H - ch - 12)) + 'px';
    } else {
      hole.style.cssText = `left:${W / 2}px;top:${H / 2}px;width:0;height:0`;
      card.style.left = (W - cw) / 2 + 'px'; card.style.top = (H - ch) / 2 + 'px';
    }
  };
  const render = () => {
    const s = STEPS[i];
    $('tour-step').textContent = `Étape ${i + 1} sur ${STEPS.length}`; $('tour-title').textContent = s.title; $('tour-text').innerHTML = s.text;
    $('tour-next').textContent = i === STEPS.length - 1 ? 'Terminer' : 'Suivant';
    ($('tour-prev') as HTMLButtonElement).style.visibility = i ? 'visible' : 'hidden';
    place();
  };
  const close = () => {
    tourEl.classList.remove('open');
    try { if ($<HTMLInputElement>('tour-never').checked) localStorage.setItem('maxernzt.tour', '1'); else localStorage.removeItem('maxernzt.tour'); } catch { /* ignoré */ }
  };
  const open = () => {
    i = 0; let never = false; try { never = localStorage.getItem('maxernzt.tour') === '1'; } catch { /* ignoré */ }
    $<HTMLInputElement>('tour-never').checked = never; tourEl.classList.add('open'); render();
  };
  $('tour-next').onclick = () => { if (i < STEPS.length - 1) { i++; render(); } else close(); };
  $('tour-prev').onclick = () => { if (i) { i--; render(); } };
  $('tour-close').onclick = close;
  addEventListener('maxernzt-tour', open);
  addEventListener('resize', () => tourEl.classList.contains('open') && place());
  addEventListener('keydown', e => {
    if (!tourEl.classList.contains('open')) return;
    if (e.key === 'Escape') { e.stopPropagation(); close(); } else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); $('tour-next').click(); } else if (e.key === 'ArrowLeft') { e.preventDefault(); $('tour-prev').click(); }
  }, true);
  // premier lancement (ou tant que « ne plus afficher » n'est pas coché), sans gêner la restauration d'un brouillon
  let seen = false; try { seen = localStorage.getItem('maxernzt.tour') === '1'; } catch { /* ignoré */ }
  if (!seen && !new URLSearchParams(location.search).has('open')) setTimeout(async () => { const a = await kvGet('autosave').catch(() => undefined); if (!a) open(); }, 600);
}
