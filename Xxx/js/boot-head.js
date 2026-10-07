/* Anti-iframe (clickjacking). Em hospedagem sem headers (GitHub Pages) não dá para usar
   frame-ancestors; se o app for aberto dentro de outro site, escondemos a tela e
   tentamos levar a janela principal para o endereço real do app. */
(function(){
  try {
    if (window.top !== window.self) {
      document.documentElement.style.display = 'none';
      try { window.top.location.replace(window.self.location.href); } catch(e){}
    }
  } catch(e) {
    document.documentElement.style.display = 'none';
  }
})();

// Zoom só é travado quando o app está instalado/aberto pela tela
// inicial (PWA em modo standalone) — aí ele se comporta como um
// aplicativo nativo, sempre no tamanho padrão ("um zoom a menos",
// que é o nosso controle de "Tamanho do app" em Configurações).
// Quando aberto pelo navegador normal (Safari/Chrome numa aba),
// o zoom funciona normalmente, igual em qualquer site.
function isStandalonePWA() {
  return (window.navigator.standalone === true) ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
}
// No navegador (Safari) NÃO usamos viewport-fit=cover: no iOS 26 ele faz os
// elementos fixos (cabeçalho e barra inferior) ficarem por baixo das barras
// flutuantes do Safari. No app instalado (standalone) continua com cover.
function updateViewport() {
  var vp = document.getElementById('viewport');
  if (!vp) return;
  vp.setAttribute(
    'content',
    isStandalonePWA()
      ? 'width=device-width,initial-scale=1,maximum-scale=1,minimum-scale=1,user-scalable=no,viewport-fit=cover'
      : 'width=device-width,initial-scale=1'
  );
}
updateViewport();

// As travas extras contra pinch-zoom e zoom por duplo-toque só se
// aplicam no modo PWA instalado (ver comentário acima). No
// navegador comum, nenhuma delas é ativada — o zoom funciona do
// jeito normal, como em qualquer site.
if (isStandalonePWA()) {
document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
document.addEventListener('gesturechange', function (e) { e.preventDefault(); }, { passive: false });
var lastTouchEnd = 0;
document.addEventListener('touchend', function (e) {
  var now = Date.now();
  if (now - lastTouchEnd <= 300) { e.preventDefault(); } // evita zoom por duplo-toque
  lastTouchEnd = now;
}, { passive: false });
}
