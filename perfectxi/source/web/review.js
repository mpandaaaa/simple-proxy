/* =====================================================================
   PERFECT XI  ·  SEASON REVIEW
   ---------------------------------------------------------------------
   The review screen was a deep dive with the replay button at the very
   bottom, under the full 20-team table. The deep dive is good and it
   stays; it just must not sit between a player and their next season.

   Three blocks go in near the top, all built from numbers the game
   already had:
     NEXT   one line that says what to chase next
     GRID   the 38-square season at a glance, on screen, not only in
            the share, so people learn what they are about to post
     SETS   which albums this run moved, framed as what is left
   ===================================================================== */
(function(){
  'use strict';

  function el(id){ return document.getElementById(id); }
  function esc(t){
    return String(t == null ? '' : t)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ------------------------------------------------- what to chase next */
  function nextLine(){
    var pts  = gs.pts || 0;
    var fin  = gs.finish || 20;
    var best = PXP.best || 0;
    var prev = (gs._prevBest != null) ? gs._prevBest : best;
    var out  = [];

    /* a personal best beats every other thing we could say */
    if(pts > prev && prev > 0){
      out.push({ k:'best', t:'NEW PERSONAL BEST',
                 s:pts + ' points, past your old record of ' + prev + '.' });
    } else if(prev > 0 && pts < prev){
      var off = prev - pts;
      out.push({ k:'chase', t:off + ' point' + (off===1?'':'s') + ' off your best',
                 s:'Your record is ' + prev + '. Another go?' });
    } else if(prev === 0){
      out.push({ k:'best', t:'FIRST SEASON IN THE BOOK',
                 s:pts + ' points is the mark to beat from here.' });
    }

    /* an ascension unlock is the strongest single next target there is */
    var a = PXP.asc || 0;
    if(fin === 1 && a > 0 && typeof PXP_ASC !== 'undefined' && PXP_ASC[a]){
      out.push({ k:'asc', t:'ASCENSION ' + a + ' UNLOCKED: ' + PXP_ASC[a].t,
                 s:PXP_ASC[a].d, cta:'Play it' });
    } else if(a > 0 && fin !== 1 && typeof PXP_ASC !== 'undefined' && PXP_ASC[a]){
      out.push({ k:'asc', t:'Ascension ' + a + ' · ' + PXP_ASC[a].t,
                 s:'Win the league at this tier to unlock the next one.' });
    }

    /* otherwise the nearest unfinished mission */
    if(out.length < 2){
      var m = nearestMission();
      if(m) out.push({ k:'mission', t:m.t, s:(m.n - m.p) + ' to go' });
    }

    if(!out.length) return '';
    var h = '';
    out.slice(0,2).forEach(function(o){
      h += '<div class="sr-next ' + o.k + '">' +
           '<div class="sr-next-b"><b>' + esc(o.t) + '</b>' +
           '<span>' + esc(o.s) + '</span></div>' +
           (o.cta ? '<button class="sr-next-go" onclick="doRestart()">' +
                    esc(o.cta) + ' ›</button>' : '') +
           '</div>';
    });
    return h;
  }
  function nearestMission(){
    var all = [], best = null;
    try{
      ['daily','weekly'].forEach(function(g){
        (PXP.missions[g] || []).forEach(function(m){ if(!m.done) all.push(m); });
      });
    }catch(e){ return null; }
    all.forEach(function(m){
      var left = m.n - m.p;
      if(!best || left < (best.n - best.p)) best = m;
    });
    return best;
  }

  /* ------------------------------------------- the season at a glance */
  function gridBlock(){
    if(typeof pxResultGrid !== 'function') return '';
    var g = pxResultGrid(gs.matchResults);
    if(!g) return '';
    var w = gs.wins || 0, d = gs.draws || 0, l = gs.losses || 0;
    return '<div class="sr-grid-wrap">' +
      '<div class="sr-grid-t">YOUR 38 GAMES</div>' +
      '<pre class="sr-grid">' + g + '</pre>' +
      '<div class="sr-grid-k">' +
        '<span><i class="w"></i>' + w + ' won</span>' +
        '<span><i class="d"></i>' + d + ' drawn</span>' +
        '<span><i class="l"></i>' + l + ' lost</span>' +
      '</div></div>';
  }

  /* ------------------------------------------------ collection remainders */
  function setsBlock(){
    if(typeof pxpNearestAlbums !== 'function') return '';
    var news = (gs._newPl || []).slice(0, 3);
    var near = pxpNearestAlbums(2);
    if(!news.length && !near.length) return '';
    var h = '<div class="sr-sets">';
    if(news.length){
      h += '<div class="sr-sets-t">NEW TO YOUR COLLECTION</div>';
      news.forEach(function(p){
        h += '<div class="sr-set-row new"><b>' + esc(p.n) + '</b>' +
             '<span>' + esc(p.c || '') + (p.y ? ' ' + esc(p.y) : '') + '</span></div>';
      });
      var more = (gs._newPl || []).length - news.length;
      if(more > 0) h += '<div class="sr-set-more">and ' + more + ' more</div>';
    }
    if(near.length){
      h += '<div class="sr-sets-t">CLOSEST TO COMPLETE</div>';
      near.forEach(function(a){
        var pct = Math.round(a.seen / a.total * 100);
        h += '<div class="sr-set-row"><b>' + esc(a.label) + '</b>' +
             '<span>' + a.seen + '/' + a.total + ' · ' + a.left + ' to go</span>' +
             '<i class="sr-set-bar"><u style="width:' + pct + '%"></u></i></div>';
      });
    }
    return h + '</div>';
  }

  /* ------------------------------------------------------------- the copy */
  function copy(){
    /* on the Daily the share has to stay spoiler-free, so hand off */
    if(gs.dailyId && window.PXDAILY){ PXDAILY.copy(); return; }
    var o = window._pxShareData;
    if(o && typeof pxCopyResult === 'function'){ pxCopyResult(o); return; }
    /* _pxShareData is only stashed when the card modal has been opened, so
       build an equivalent payload rather than silently doing nothing */
    var stats = [], n;
    try{
      for(n in gs.playerStats) stats.push({ n:n, g:gs.playerStats[n].g, a:gs.playerStats[n].a });
      stats.sort(function(x,y){ return y.g - x.g || y.a - x.a; });
    }catch(e){}
    var fallback = {
      finish: gs.finish || 20,
      pts: gs.pts || 0,
      ovr: Math.round((typeof squadAvg === 'function' ? squadAvg(null) : 0) || 0),
      formation: cfg.formation,
      results: gs.matchResults,
      golden: stats.length ? stats[0].n : '',
      pots: ''
    };
    if(typeof pxCopyResult === 'function') pxCopyResult(fallback);
  }

  function paint(){
    var a = el('pxSrNext'); if(a) a.innerHTML = nextLine();
    var b = el('pxSrGrid'); if(b) b.innerHTML = gridBlock();
    var c = el('pxSrSets'); if(c) c.innerHTML = setsBlock();
  }

  window.pxSrCopy = copy;
  window.PXREVIEW = { paint: paint };
})();
