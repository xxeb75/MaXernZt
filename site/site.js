// Les vidéos d'exemple ne se lancent que lorsqu'elles sont visibles (et pas du tout si l'utilisateur préfère moins d'animations).
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const vids = [...document.querySelectorAll('video[data-autoplay]')];
if (!reduce && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause(); }), { threshold: 0.35 });
  vids.forEach(v => io.observe(v));
} else vids.forEach(v => { v.controls = true; });
const intro = document.getElementById('intro');
if (intro && !reduce) { intro.play().catch(() => {}); }   // lecture muette en boucle ; l'utilisateur garde les commandes
