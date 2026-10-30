// Mesure d'audience anonyme (GoatCounter, sans cookie), uniquement sur la version en ligne ; jamais dans l'appli de bureau.
if (location.hostname.endsWith('.github.io')) {
  const gc = document.createElement('script');
  gc.async = true; gc.src = 'https://gc.zgo.at/count.js';
  gc.setAttribute('data-goatcounter', 'https://maxernzt.goatcounter.com/count');
  document.head.appendChild(gc);
}
