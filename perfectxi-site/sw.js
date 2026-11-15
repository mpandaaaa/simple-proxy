/* Perfect XI — offline service worker */
var CACHE='pxi-s68-1';
var CORE=['/','/index.html','/manifest.json','/icon-192.png','/icon-512.png','/about.html','/contact.html','/how-to-play.html','/guides.html','/faq.html',
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/favicon-96x96.png',
  '/apple-touch-icon.png',
  '/icon-maskable-512.png',
  '/og-image.png',
  '/ucl-mode.js',
  '/ucl_teams.js',
  '/app-config.js',
  '/app-banner.js',
  '/app-promo.js',
  '/ucl_squads.js',
  '/mp-config.js',
  '/mp.js',
  '/mp-ui.js',
  '/kovakits.js',
  '/daily.js',
  '/review.js',
  '/progress-sync.js'
];
self.addEventListener('install',function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(CORE);}).then(function(){return self.skipWaiting();}));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){if(k!==CACHE)return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}));
});
self.addEventListener('fetch',function(e){
  if(e.request.method!=='GET')return;
  var url=new URL(e.request.url);
  if(url.origin!==location.origin)return; /* fonts/CDN: let the browser handle */
  var isPage=(e.request.mode==='navigate')||/\.html$/.test(url.pathname)||url.pathname==='/';
  if(isPage){
    /* network-first for pages: deployed fixes show up immediately, offline still works */
    e.respondWith(
      fetch(e.request).then(function(res){
        if(res&&res.status===200){var copy=res.clone();caches.open(CACHE).then(function(c){c.put(e.request,copy);});}
        return res;
      }).catch(function(){
        return caches.match(e.request).then(function(hit){return hit||caches.match('/index.html');});
      })
    );
    return;
  }
  /* cache-first for static assets */
  e.respondWith(
    caches.match(e.request).then(function(hit){
      var net=fetch(e.request).then(function(res){
        if(res&&res.status===200){var copy=res.clone();caches.open(CACHE).then(function(c){c.put(e.request,copy);});}
        return res;
      }).catch(function(){return hit;});
      return hit||net;
    })
  );
});
