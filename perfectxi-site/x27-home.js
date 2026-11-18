/* =====================================================================
   PERFECT XI HOME, SEASON 26/27: THE DRAFT, PLAYING ITSELF
   ---------------------------------------------------------------------
   A short loop inside the Start a draft card. The reel spins through
   real club seasons, lands, and the player it gives you drops onto the
   pitch. Eleven times, then the season's record ticks up. Every player,
   club and rating is a real one from the game.

   It only runs while the home screen is on show and the card is on the
   screen. With reduced motion turned on it shows the finished XI.
   Same style as the rest of the codebase: var, no arrow functions.
   ===================================================================== */
(function(){
  'use strict';

  /* x and y are percentages of the pitch, attacking upwards (4-3-3) */
  var XI = [
    {c:'Arsenal 04/05',    n:'Henry',      i:'TH', r:95, x:50, y:16},
    {c:'Man City 20/21',   n:'De Bruyne',  i:'KD', r:93, x:50, y:42},
    {c:'Man City 12/13',   n:'Kompany',    i:'VK', r:89, x:38, y:67},
    {c:'Man United 98/99', n:'Schmeichel', i:'PS', r:89, x:50, y:89},
    {c:'Blackburn 94/95',  n:'Shearer',    i:'AS', r:92, x:20, y:21},
    {c:'Chelsea 05/06',    n:'Lampard',    i:'FL', r:91, x:24, y:45},
    {c:'Man United 08/09', n:'Vidic',      i:'NV', r:88, x:62, y:67},
    {c:'Liverpool 13/14',  n:'Suarez',     i:'LS', r:94, x:80, y:21},
    {c:'Liverpool 19/20',  n:'Robertson',  i:'AR', r:87, x:13, y:64},
    {c:'Arsenal 02/03',    n:'Vieira',     i:'PV', r:89, x:76, y:45},
    {c:'Arsenal 25/26',    n:'Saliba',     i:'WS', r:89, x:87, y:64}
  ];
  var DECOYS = ['Leeds 99/00','Newcastle 95/96','Tottenham 18/19','Everton 04/05','Leicester 15/16',
    'Aston Villa 92/93','Blackburn 97/98','Wimbledon 93/94','Ipswich 00/01','Chelsea 14/15',
    'Southampton 02/03','West Ham 98/99','Norwich 92/93','Bolton 05/06','Fulham 08/09','Wigan 12/13'];

  var SPIN = 6, STEP = 70, LAND = 300, TALLY = 1500, HOLD = 2400;

  var root, reelK, reelV, reelP, slots, chips = [];
  var REC = {w: 30, d: 5, l: 3, p: 95};
  var timer = null, running = false, visible = true, gen = 0;

  function q(sel){ return root.querySelector(sel); }
  function later(fn, ms, g){ timer = setTimeout(function(){ if(g === gen) fn(); }, ms); }
  function reduced(){
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function homeOn(){
    var h = document.getElementById('home');
    return !!(h && h.classList.contains('active'));
  }

  function build(){
    var html = '', k;
    for(k = 0; k < XI.length; k++){
      html += '<span class="xd-chip" style="left:' + XI[k].x + '%;top:' + XI[k].y + '%">' +
        '<em>' + XI[k].i + '</em><b>' + XI[k].r + '</b></span>';
    }
    slots.innerHTML = html;
    chips = slots.querySelectorAll('.xd-chip');
  }

  /* the season's record, f of the way through the season */
  function record(f){
    var g = Math.round(38 * f), w = Math.round(REC.w * f), d = Math.min(Math.round(REC.d * f), g - w);
    reelV.textContent = 'W' + w + ' D' + d + ' L' + Math.max(0, g - w - d);
    reelP.textContent = Math.round(REC.p * f) + ' pts';
  }

  /* the finished XI, for reduced motion and for when it is paused */
  function finished(){
    for(var k = 0; k < chips.length; k++) chips[k].className = 'xd-chip on';
    reelK.textContent = 'Full time';
    record(1);
    root.classList.remove('spinning', 'landed');
    root.classList.add('done');
  }

  function reset(){
    for(var k = 0; k < chips.length; k++) chips[k].className = 'xd-chip';
    root.classList.remove('done', 'fade');
  }

  function pick(k, g){
    if(k >= XI.length){ tally(g); return; }
    var p = XI[k], s = 0;
    root.classList.add('spinning');
    root.classList.remove('landed');
    reelK.textContent = 'Spin ' + (k + 1) + ' of 11';
    reelP.textContent = ' ';
    (function roll(){
      if(s < SPIN){
        reelV.textContent = DECOYS[(k * 5 + s * 3) % DECOYS.length];
        s++;
        later(roll, STEP, g);
        return;
      }
      reelV.textContent = p.c;
      reelP.textContent = p.n + ' · ' + p.r;
      root.classList.remove('spinning');
      root.classList.add('landed');
      chips[k].className = 'xd-chip on new';
      if(k > 0) chips[k - 1].className = 'xd-chip on';
      later(function(){ pick(k + 1, g); }, LAND + 120, g);
    })();
  }

  function tally(g){
    chips[XI.length - 1].className = 'xd-chip on';
    root.classList.add('done');
    root.classList.remove('landed');
    reelK.textContent = 'Playing the season';
    var t0 = Date.now();
    (function count(){
      var f = Math.min(1, (Date.now() - t0) / TALLY);
      record(1 - Math.pow(1 - f, 2));
      if(f < 1){ later(count, 40, g); return; }
      reelK.textContent = 'Full time';
      later(function(){
        root.classList.add('fade');
        later(function(){ reset(); pick(0, g); }, 450, g);
      }, HOLD, g);
    })();
  }

  function start(){
    if(running || reduced()) return;
    running = true;
    gen++;
    clearTimeout(timer);
    reset();
    pick(0, gen);
  }
  function stop(){
    if(!running) return;
    running = false;
    gen++;
    clearTimeout(timer);
    finished();
  }
  function check(){
    if(visible && homeOn() && !document.hidden) start(); else stop();
  }

  function init(){
    root = document.getElementById('x27Demo');
    if(!root) return;
    reelK = q('.xd-reel-k'); reelV = q('.xd-reel-v'); reelP = q('.xd-reel-p');
    slots = q('.xd-slots');
    build();
    finished();
    if(reduced()) return;

    if('IntersectionObserver' in window){
      new IntersectionObserver(function(es){
        visible = es[0].isIntersecting;
        check();
      }, {threshold: 0.25}).observe(root);
    }
    document.addEventListener('visibilitychange', check);
    /* the game switches screens by toggling .active on #home */
    var home = document.getElementById('home');
    if(home && 'MutationObserver' in window){
      new MutationObserver(check).observe(home, {attributes: true, attributeFilter: ['class']});
    }
    check();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
