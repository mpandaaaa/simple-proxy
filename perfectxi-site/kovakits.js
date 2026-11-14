/* =====================================================================
   KOVAKITS PARTNER UNIT
   A plain link to a sister site, styled in Perfect XI's own language.
   Not an ad unit, no third party script, no network request, no image
   loaded from elsewhere, so it cannot shift the layout or interfere
   with AdSense.

   EVERYTHING YOU MIGHT WANT TO CHANGE IS IN THIS ONE OBJECT.
   ===================================================================== */
window.KOVA = {

  /* master switch. false removes it from every screen. */
  ON: true,

  /* The shop is open, so every unit reads "Shop now".
     To run a countdown for a future drop instead, set LIVE:false and put
     the opening moment in OPENS with the wording you want in OPENS_LABEL. */
  LIVE: true,
  OPENS: '2026-09-25T19:00:00+01:00',   /* ignored while LIVE is true */
  OPENS_LABEL: 'Opens Friday 7pm',      /* ignored while LIVE is true */

  /* where each placement is allowed */
  SHOW: {
    squadComplete: true,    /* after an XI is built */
    seasonEnd:     true,    /* on the season results screen */
    home:          true,    /* one card among the modes */
    shareCard:     false    /* a line on the shared image, off by default */
  },

  /* links. the UTM tags are what show up in the shop's analytics. */
  UTM: '?utm_source=perfectxi&utm_medium=referral&utm_campaign=launch',
  URL: {
    shop:    'https://kovakits.com/',
    retro:   'https://kovakits.com/shop?collection=retro-kits',
    special: 'https://kovakits.com/shop?collection=special-editions'
  },

  /* copy. one of these is picked per placement. */
  COPY: {
    squadComplete: { k:'Partner', t:'Just drafted him? Wear the shirt.',
      s:'Every club in the draft. Every kit in the shop.' },
    seasonEnd:     { k:'Partner', t:'Get your club\u2019s shirt',
      s:'Retro kits, concept kits, 26/27 season. Buy 2, get the 3rd free.' },
    home:          { k:'Partner', t:'KovaKits',
      s:'Fan version shirts. Free worldwide shipping.' }
  },

  /* shown small under every unit, because Mo owns both sites */
  OWNER: 'KovaKits is made by the team behind Perfect XI',

  /* fan version, never official or licensed */
  DISCLAIMER: 'Fan version shirts. Not official merchandise.'
};

(function(){
  var K = window.KOVA;
  if (!K) return;

  function open(){
    if (K.LIVE) return true;
    try { return Date.now() >= new Date(K.OPENS).getTime(); } catch(e){ return false; }
  }
  function link(which){
    return (K.URL[which] || K.URL.shop) +
      (String(K.URL[which]||'').indexOf('?') >= 0
        ? '&' + K.UTM.slice(1)
        : K.UTM);
  }
  function cta(){
    return open() ? 'Shop now' : (K.OPENS_LABEL || 'Opening soon');
  }

  /* a shirt, drawn inline. no request, so nothing can move on load. */
  var SHIRT = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
    '<path fill="currentColor" d="M8.5 2 12 4.2 15.5 2 21 5.1l-2.1 4-2.2-1.1V22H7.3V8L5.1 9.1 3 5.1z"/></svg>';

  /* placement = key in SHOW/COPY. returns an element, or null. */
  function unit(placement, which){
    if (!K.ON || !K.SHOW[placement]) return null;
    var c = K.COPY[placement] || K.COPY.home;
    var a = document.createElement('a');
    a.className = 'kk-unit';
    a.href = link(which || 'shop');
    a.target = '_blank';
    a.rel = 'noopener sponsored';
    a.setAttribute('data-kk', placement);
    a.innerHTML =
      '<span class="kk-ic">' + SHIRT + '</span>' +
      '<span class="kk-b">' +
        '<span class="kk-k">' + c.k + '</span>' +
        '<span class="kk-t">' + c.t + '</span>' +
        '<span class="kk-s">' + c.s + '</span>' +
        '<span class="kk-o">' + K.OWNER + '</span>' +
      '</span>' +
      '<span class="kk-cta">' + cta() + '</span>';
    return a;
  }

  /* append to a container if it exists and we have not already */
  function mount(placement, container, which){
    if (!container) return null;
    if (container.querySelector && container.querySelector('[data-kk="'+placement+'"]')) return null;
    var el = unit(placement, which);
    if (el) container.appendChild(el);
    return el;
  }

  K.open = open;
  K.link = link;
  K.cta = cta;
  K.unit = unit;
  K.mount = mount;
})();
