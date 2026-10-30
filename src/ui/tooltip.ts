import { $ } from './dom';

// ---- infobulles : un seul élément au niveau de la page, donc toujours au-dessus des panneaux (jamais coupé ni recouvert)
export function initTooltips() {
  const tip = document.createElement('div'); tip.id = 'tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip);
  let cur: HTMLElement | null = null, timer = 0;
  const hide = () => { clearTimeout(timer); cur = null; tip.classList.remove('on'); };
  const show = (el: HTMLElement) => {
    const txt = el.dataset.tip; if (!txt || !el.isConnected) return;
    tip.textContent = txt; tip.style.left = '0px'; tip.style.top = '0px';
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, g = 8, pos = el.dataset.pos ?? 'bottom';
    let x = r.left + r.width / 2 - w / 2, y = r.bottom + g;
    if (pos === 'top') y = r.top - h - g;
    else if (pos === 'right') { x = r.right + g; y = r.top + r.height / 2 - h / 2; }
    else if (pos === 'bottom-start') x = r.left;
    else if (pos === 'bottom-left') x = r.right - w;
    if (pos !== 'right' && pos !== 'top' && y + h > innerHeight - 4) y = r.top - h - g;   // plus de place dessous : au-dessus
    if (pos === 'top' && y < 4) y = r.bottom + g;                                         // plus de place dessus : dessous
    tip.style.left = Math.max(4, Math.min(x, innerWidth - w - 4)) + 'px'; tip.style.top = Math.max(4, Math.min(y, innerHeight - h - 4)) + 'px';
    tip.classList.add('on');
  };
  addEventListener('pointerover', e => {
    const el = (e.target as HTMLElement).closest?.('[data-tip]') as HTMLElement | null;
    if (el === cur) return;
    hide(); if (!el) return;
    cur = el; timer = window.setTimeout(() => cur && show(cur), 250);
  });
  addEventListener('pointerdown', hide, true); addEventListener('wheel', hide, { passive: true }); addEventListener('keydown', hide);
  document.addEventListener('pointerleave', hide);
}
