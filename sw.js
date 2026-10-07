const CACHE = '2letters-v53';
const ASSETS = [
  './','./index.html','./calendar.js','./manifest.webmanifest','./logo-2l.jpg',
  './icon-192.png','./icon-512.png','./icon-512-maskable.png','./apple-touch-icon.png',
  './js/boot-head.js','./js/firebase-init.js','./js/boot-end.js','./js/00-firestore-sync.js','./js/01-util-auth.js','./js/02-estado.js','./js/03-realtime-storage.js',
  './js/04-layout-zoom.js','./js/05-init.js','./js/06-agenda.js','./js/07-notificacoes.js',
  './js/08-financeiro-fiados.js','./js/09-clientes-servicos.js','./js/10-anamnese.js',
  './js/11-admin-config.js','./js/12-render-all.js','./js/13-login-autofill.js','./js/14-tabbar-nativa.js','./js/15-ios-zoom-fix.js','./js/16-instalar-app.js','./js/17-onboarding.js',
  './css/01-tokens-base.css','./css/02-layout-header-nav.css','./css/03-auth-login.css',
  './css/04-modais-base.css','./css/05-agenda.css','./css/06-dashboard.css',
  './css/07-financeiro-clientes.css','./css/08-config-anamnese.css','./css/09-etapas-dark-premium.css','./css/10-tabbar-nativa.css','./css/11-tema-claro-e-cores.css','./css/12-instalar-app.css','./css/13-dashboard-modelo8.css','./css/14-agenda-menu.css','./css/15-onboarding.css'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

// Domínios de API/dados em tempo real (Firebase Auth/Firestore) NUNCA
// passam pelo cache do Service Worker — são chamadas de dados, não
// arquivos estáticos. Interceptar/cachear isso pode servir respostas
// de streaming incompletas ou dados desatualizados sem a pessoa saber.
const NUNCA_INTERCEPTAR = [
  'firestore.googleapis.com',
  'firebaseapp.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'googleapis.com'
];
function isNuncaInterceptar(url){
  try { const h = new URL(url).hostname; return NUNCA_INTERCEPTAR.some(dom => h.endsWith(dom)); }
  catch(e){ return false; }
}

// Arquivos de imagem: raramente mudam, então respondem na hora com o
// que já está em cache (mais rápido, funciona offline) e atualizam o
// cache por trás para a próxima vez, sem atrasar a resposta atual.
function isImagem(url){ return /\.(png|jpe?g|gif|webp|svg|ico)(\?|$)/i.test(url); }

self.addEventListener('fetch', e=>{
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;

  // Firebase e afins: sempre direto para a rede, sem passar pelo SW.
  if (isNuncaInterceptar(url)) return;

  if (isImagem(url)) {
    e.respondWith(
      caches.match(req).then(cached=>{
        const atualizarEmSegundoPlano = fetch(req).then(res=>{
          const copy = res.clone();
          caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>{});
          return res;
        }).catch(()=> cached);
        return cached || atualizarEmSegundoPlano;
      })
    );
    return;
  }

  // HTML, JS e CSS continuam "rede primeiro, cache como reserva" — é o
  // que garante que, depois de publicar uma correção nova (a gente
  // sempre sobe a versão do CACHE a cada etapa), o app carregue a
  // versão nova assim que a pessoa estiver online, em vez de ficar
  // preso numa versão antiga até um segundo carregamento.
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res=>{
        if(res && res.ok){
          const copy = res.clone();
          caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>{});
        }
        return res;
      })
      .catch(()=> caches.match(req, { ignoreSearch: true }).then(r=> r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});


// ===== Notificações do celular =====
// Toque na notificação: abre/traz o app e leva até o agendamento (ou cliente) do aviso.
self.addEventListener('notificationclick', e=>{
  e.notification.close();
  const data = e.notification.data || {};
  e.waitUntil((async()=>{
    const lista = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
    for(const c of lista){
      if('focus' in c){
        await c.focus();
        c.postMessage({ type:'notif-click', data });
        return;
      }
    }
    let url = './index.html';
    const t = data.target;
    if(t) url += '?ntype=' + encodeURIComponent(t.type||'') + '&nid=' + encodeURIComponent(t.id||'') + '&nbusca=' + encodeURIComponent(t.busca||'');
    if(self.clients.openWindow) await self.clients.openWindow(url);
  })());
});

// Push de servidor (Web Push/FCM): mostra a notificação mesmo com o app fechado.
self.addEventListener('push', e=>{
  let d = {};
  try{ d = e.data ? e.data.json() : {}; }catch(_){ d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || '2letters', {
    body: d.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200,100,200],
    data: d.data || {}
  }));
});
