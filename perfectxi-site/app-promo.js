/* =====================================================================
   PERFECT XI - IN-GAME APP PROMOTION
   Fires only at the moments a player has just finished something and is
   feeling good about it. Never mid-game, never over the pitch, never
   more than twice a session, and permanently silenced once dismissed.
   Offers no reward for installing (App Store rule 3.2.2), only reasons.
   ===================================================================== */
(function(){
  if (typeof document === 'undefined') return;
  var A = window.PXI_APP || {};
  var SEEN = 'pxi_promo_off', COUNT = 'pxi_promo_n';
  var shown = 0, MAX_PER_SESSION = 2;

  function off(){ try { return localStorage.getItem(SEEN) === '1'; } catch(e){ return false; } }
  function silence(){ try { localStorage.setItem(SEEN,'1'); } catch(e){} }
  function seen(){ try { return +(localStorage.getItem(COUNT)||0); } catch(e){ return 0; } }
  function bump(){ try { localStorage.setItem(COUNT, seen()+1); } catch(e){} }
  function installed(){
    return window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  }

  var CSS = '#pxiPromo{position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;' +
    'justify-content:center;background:rgba(0,0,0,.62);opacity:0;transition:opacity .28s ease}' +
    '#pxiPromo.on{opacity:1}' +
    '#pxiPromo .sh{width:100%;max-width:460px;background:linear-gradient(180deg,#17211B,#0F1713);' +
    'border-top:1px solid rgba(255,255,255,.10);border-radius:22px 22px 0 0;padding:26px 22px ' +
    'calc(24px + env(safe-area-inset-bottom));transform:translateY(24px);transition:transform .34s cubic-bezier(.2,.9,.3,1);' +
    'box-shadow:0 -14px 46px rgba(0,0,0,.62)}' +
    '#pxiPromo.on .sh{transform:translateY(0)}' +
    '@media(min-width:700px){#pxiPromo{align-items:center}#pxiPromo .sh{border-radius:22px;border:1px solid rgba(255,255,255,.10)}}' +
    '#pxiPromo .ic{width:74px;height:74px;border-radius:17px;display:block;margin:0 auto 15px;' +
    'box-shadow:0 8px 26px rgba(31,197,126,.34)}' +
    '#pxiPromo h3{margin:0 0 8px;text-align:center;color:#E6EDE9;font-size:1.42rem;line-height:1.2;' +
    'font-family:"Barlow Condensed",Impact,sans-serif;font-weight:700}' +
    '#pxiPromo p{margin:0 0 18px;text-align:center;color:#A9B7AF;font-size:.94rem;line-height:1.5}' +
    '#pxiPromo .b{display:block;width:100%;padding:16px;border:0;border-radius:13px;background:#1FC57E;' +
    'color:#04120B;font-weight:800;font-size:1.02rem;text-align:center;text-decoration:none;' +
    'cursor:pointer;font-family:inherit;min-height:54px;line-height:22px}' +
    '#pxiPromo .l{display:block;width:100%;margin-top:11px;padding:11px;border:0;background:none;' +
    'color:#6E7E74;font-size:.87rem;cursor:pointer;font-family:inherit}' +
    '#pxiPromo .tag{display:block;text-align:center;color:#D6B25E;font-size:.7rem;font-weight:700;' +
    'letter-spacing:.15em;text-transform:uppercase;margin-bottom:11px;font-family:"Barlow Condensed",sans-serif}';

  var injected = false;
  function styles(){
    if (injected) return; injected = true;
    var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
  }

  /* moment: a short line about what they just did, so it never feels random */
  function show(moment){
    if (off() || installed() || shown >= MAX_PER_SESSION) return;
    shown++; bump(); styles();

    var live = !!A.LIVE;
    var el = document.createElement('div');
    el.id = 'pxiPromo';
    el.innerHTML =
      '<div class="sh" role="dialog" aria-label="Perfect XI for iPhone">' +
        '<span class="tag">' + (live ? 'Out now' : 'Coming soon') + '</span>' +
        '<img class="ic" src="/apple-touch-icon.png" alt="" width="74" height="74">' +
        '<h3>' + (moment || 'Nice work.') + '<br>Take it with you.</h3>' +
        '<p>' + (live
          ? 'Perfect XI is on the App Store. Plays offline, opens instantly, sits on your home screen.'
          : 'The iPhone version is with Apple now. Plays offline, opens instantly, sits on your home screen.') + '</p>' +
        '<a class="b" href="' + (live ? window.pxiStoreLink('ingame') : '/ios') + '">' +
          (live ? 'Get it free' : 'Tell me when it lands') + '</a>' +
        '<button class="l" type="button">Not now</button>' +
      '</div>';

    document.body.appendChild(el);
    requestAnimationFrame(function(){ el.classList.add('on'); });

    function close(perm){
      el.classList.remove('on');
      if (perm) silence();
      setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    }
    el.querySelector('.l').onclick = function(){ close(seen() >= 3); };  // 3 declines = stop asking
    el.onclick = function(e){ if (e.target === el) close(false); };
    el.querySelector('.b').onclick = function(){ silence(); };
  }

  window.pxiPromo = show;
})();
