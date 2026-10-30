import { $ } from './dom';
import { HELP } from '../help';

// ---- aide : sections à gauche, contenu à droite, recherche par mot ; F1 ou bouton ?
export function initHelp() {
  const el = $('help'), nav = $('help-nav'), body = $('help-body'), q = $<HTMLInputElement>('help-q');
  let cur = HELP[0].id;
  const textOf = (s: { title: string; html: string }) => (s.title + ' ' + s.html.replace(/<[^>]+>/g, ' ')).toLowerCase();
  const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const matches = () => { const w = norm(q.value.trim()); return w ? HELP.filter(s => norm(textOf(s)).includes(w)) : HELP; };
  const show = (id: string) => {
    cur = id; const s = HELP.find(x => x.id === id)!;
    body.innerHTML = `<h2><svg class="ic"><use href="#i-${s.icon}"/></svg>${s.title}</h2>` + s.html; body.scrollTop = 0;
    const w = q.value.trim();
    if (w) {   // met le mot cherché en évidence dans le texte (hors balises)
      const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const walk = (n: Element) => {
        for (const c of [...n.childNodes]) {
          if (c.nodeType === 3 && c.textContent && re.test(c.textContent)) { re.lastIndex = 0; const sp = document.createElement('span'); sp.innerHTML = c.textContent.replace(/[&<]/g, m => (m === '&' ? '&amp;' : '&lt;')).replace(re, m => `<mark class="hl">${m}</mark>`); c.replaceWith(...sp.childNodes); }
          else if (c.nodeType === 1 && (c as Element).tagName !== "svg") walk(c as Element);
        }
      };
      walk(body);
    }
    nav.querySelectorAll('.hn').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.id === id));
  };
  const renderNav = () => {
    const list = matches(); nav.innerHTML = '';
    if (!list.length) { nav.innerHTML = '<div class="none">Aucune section ne contient ce mot.</div>'; body.innerHTML = ''; return; }
    for (const s of list) {
      const b = document.createElement('button'); b.className = 'hn'; b.dataset.id = s.id;
      b.innerHTML = `<svg class="ic"><use href="#i-${s.icon}"/></svg><span></span>`; (b.querySelector('span') as HTMLElement).textContent = s.title;
      b.onclick = () => show(s.id); nav.appendChild(b);
    }
    show(list.some(s => s.id === cur) ? cur : list[0].id);
  };
  const open = (id?: string) => { if (id) cur = id; q.value = ''; el.classList.add('open'); renderNav(); };
  const close = () => el.classList.remove('open');
  q.oninput = renderNav;
  $('btn-help').onclick = () => (el.classList.contains('open') ? close() : open());
  $('help-close').onclick = close;
  $('help-tour').onclick = () => { close(); window.dispatchEvent(new Event('maxernzt-tour')); };
  el.addEventListener('pointerdown', e => { if (e.target === el) close(); });
  addEventListener('keydown', e => {
    if (e.key === 'F1') { e.preventDefault(); e.stopPropagation(); if (el.classList.contains('open')) close(); else open(); return; }
    if (e.key === 'Escape' && el.classList.contains('open')) { e.stopPropagation(); close(); }
  }, true);
}
