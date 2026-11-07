/* =====================================================================
   A small, dismissible bar. Deliberately NOT an interstitial: Google
   penalises pop-ups that cover content on a search landing, and exempts
   "banners that use a reasonable amount of screen space and are easily
   dismissible". This is the second kind.
   It never covers the game and never blocks a tap.
   ===================================================================== */
(function(){
  if (typeof document === 'undefined') return;
  var A = window.PXI_APP || {};
  var KEY = 'pxi_bar_dismissed_v1';
  try { if (localStorage.getItem(KEY) === (A.LIVE ? 'live' : 'soon')) return; } catch(e){}

  var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  var standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  if (standalone) return;                       // already installed as a PWA
  if (!iOS && !A.LIVE) return;                  // pre-launch: only tease iPhone users

  function build(){
    var bar = document.createElement('div');
    bar.id = 'pxiBar';
    bar.setAttribute('role','complementary');
    bar.innerHTML =
      '<img class="pxi-ic" src="/favicon-96x96.png" alt="" width="38" height="38">' +
      '<span class="pxi-tx"><b>' + (A.LIVE ? 'Perfect XI for iPhone' : 'Perfect XI is coming to iPhone') + '</b>' +
      '<i>' + (A.LIVE ? 'Free on the App Store' : 'Get told the day it lands') + '</i></span>' +
      '<a class="pxi-go" href="' + (A.LIVE ? window.pxiStoreLink('site_bar') : '/ios') + '">' +
        (A.LIVE ? 'Get' : 'Notify me') + '</a>' +
      '<button class="pxi-x" aria-label="Dismiss">&times;</button>';

    var css = document.createElement('style');
    css.textContent =
      '#pxiBar{position:fixed;left:0;right:0;bottom:0;z-index:9998;display:flex;align-items:center;' +
      'gap:11px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:#0F1713;' +
      'border-top:1px solid rgba(255,255,255,.10);box-shadow:0 -6px 22px rgba(0,0,0,.5);' +
      'font-family:Inter,system-ui,sans-serif;transform:translateY(100%);transition:transform .32s cubic-bezier(.2,.9,.3,1)}' +
      '#pxiBar.on{transform:translateY(0)}' +
      '#pxiBar .pxi-ic{width:38px;height:38px;border-radius:9px;flex:0 0 auto;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.5)}' +
      '#pxiBar .pxi-tx{flex:1 1 auto;min-width:0;line-height:1.25}' +
      '#pxiBar .pxi-tx b{display:block;color:#E6EDE9;font-size:.83rem;font-weight:700;' +
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#pxiBar .pxi-tx i{display:block;color:#8FA096;font-size:.74rem;font-style:normal;' +
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#pxiBar .pxi-go{flex:0 0 auto;padding:9px 15px;border-radius:9px;background:#1FC57E;' +
      'color:#04120B;font-weight:800;font-size:.82rem;text-decoration:none;min-height:38px;' +
      'display:inline-flex;align-items:center}' +
      '#pxiBar .pxi-x{flex:0 0 auto;width:30px;height:30px;border:0;background:transparent;' +
      'color:#6E7E74;font-size:1.35rem;line-height:1;cursor:pointer;padding:0}' +
      '@media(min-width:700px){#pxiBar{left:auto;right:18px;bottom:18px;max-width:400px;' +
      'border-radius:15px;border:1px solid rgba(255,255,255,.10)}}' +
      '@media(prefers-reduced-motion:reduce){#pxiBar{transition:none}}';

    document.head.appendChild(css);
    document.body.appendChild(bar);
    requestAnimationFrame(function(){ bar.classList.add('on'); });

    bar.querySelector('.pxi-x').onclick = function(){
      bar.classList.remove('on');
      try { localStorage.setItem(KEY, A.LIVE ? 'live' : 'soon'); } catch(e){}
      setTimeout(function(){ if (bar.parentNode) bar.parentNode.removeChild(bar); }, 340);
    };
  }
  /* wait a few seconds so it never competes with the game loading */
  function go(){ setTimeout(build, 3500); }
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go);
})();
