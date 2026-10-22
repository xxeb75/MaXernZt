// Les vidéos d'exemple ne se lancent que lorsqu'elles sont visibles (et pas du tout si l'utilisateur préfère moins d'animations).
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const vids = [...document.querySelectorAll('video[data-autoplay]')];
if (!reduce && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause(); }), { threshold: 0.35 });
  vids.forEach(v => io.observe(v));
} else vids.forEach(v => { v.controls = true; });
const intro = document.getElementById('intro');
if (intro && !reduce) { intro.play().catch(() => {}); }   // lecture muette en boucle ; l'utilisateur garde les commandes

// démo avec le son : lecture muette quand elle est visible ; le bouton active le son (un geste de l'utilisateur est nécessaire)
const sv = document.getElementById('sonvid'), sb = document.getElementById('soundbtn');
if (sv && sb) {
  if (!reduce && 'IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) sv.play().catch(() => {}); else { sv.pause(); } }), { threshold: 0.4 }).observe(sv);
  const label = () => { sb.setAttribute('aria-pressed', String(!sv.muted)); sb.querySelector('span').textContent = sv.muted ? 'Activer le son' : 'Couper le son'; sb.querySelector('use').setAttribute('href', sv.muted ? '#i-sound' : '#i-mute'); };
  sb.addEventListener('click', () => { sv.muted = !sv.muted; if (!sv.muted) { sv.currentTime = 0; sv.volume = 0.9; sv.play().catch(() => {}); } label(); });
  label();
}
