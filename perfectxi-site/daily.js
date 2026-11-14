/* =====================================================================
   PERFECT XI  ·  THE DAILY
   ---------------------------------------------------------------------
   One draft a day. Everybody in the world gets the same wheel, the same
   spins and the same season, because the whole run is driven by a seed
   made from today's date. One attempt, no rerolling the day.

   The share is deliberately spoiler-free: a shape, not a team sheet. If
   the grid named your striker it would tell your mates which club-season
   is in today's wheel before they have played it.

   Written in the same style as the rest of the codebase: var, function
   declarations, no arrow functions, no template literals.
   ===================================================================== */
(function(){
  'use strict';

  /* Daily #1 was 11 October 2026. The day number itself comes from the
     LOCAL calendar date, so a late-night session in BST still counts as
     the right day. */
  var EPOCH = 20737;
  var FORMS = ['4-3-3','4-4-2','4-2-3-1','3-5-2','4-1-4-1','3-4-3','4-2-3-1','4-4-2'];
  var REROLLS = 2;
  var LS_PREFIX = 'pxi_daily_';

  function day(){
    if(typeof pxEpochDay === 'function') return pxEpochDay();
    var d = new Date();
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }
  function no(){ return day() - EPOCH + 1; }
  function key(d){ return LS_PREFIX + (d || day()); }
  function seed(d){
    /* a big odd multiplier spreads consecutive days to unrelated seeds */
    var x = ((d || day()) * 2654435761) % 2147483647;
    return x < 0 ? x + 2147483647 : x;
  }
  function formation(d){ return FORMS[(d || day()) % FORMS.length]; }

  function saved(d){
    try{ return JSON.parse(localStorage.getItem(key(d)) || 'null'); }catch(e){ return null; }
  }
  function played(){ return !!saved(); }

  /* ------------------------------------------------------- the share text */
  function grid(res){
    if(typeof pxResultGrid === 'function' && res) return pxResultGrid(res);
    return '';
  }
  function shareText(r){
    var L = [];
    var medal = r.fin === 1 ? '🏆' : r.fin === 2 ? '🥈' : r.fin === 3 ? '🥉' : '';
    L.push('Perfect XI Daily #' + r.no + (medal ? ' ' + medal : ''));
    L.push(ordinal(r.fin) + ' · ' + r.pts + ' pts · ' + r.ovr + ' OVR');
    if(r.grid) L.push(r.grid);
    if(r.pct != null) L.push('Beat ' + r.pct + '% of today’s managers');
    if(r.streak > 1) L.push('🔥 ' + r.streak + '-day streak');
    /* No player names and no link. Names are a spoiler; a link reads as
       spam and stops people reposting it. */
    return L.join('\n');
  }
  function ordinal(p){
    if(!p) return '—';
    if(typeof pxOrdinalWord === 'function') return pxOrdinalWord(p);
    return String(p);
  }

  /* ------------------------------------------------------------- starting */
  function start(){
    if(played()){ open(); return; }
    var d = day();
    if(typeof startDraft !== 'function'){ return; }

    /* Everything that could differ between two players has to be pinned,
       or the "same game for everyone" promise is a lie. */
    cfg.mode    = 'squad';
    cfg.rtype   = 'prime';
    cfg.eraFrom = 1992;
    cfg.eraTo   = 2026;
    cfg.ratings = 'on';
    cfg.formation = formation(d);

    startDraft();                       /* clears the per-run tags */
    try{ if(typeof pxAscClear === 'function') pxAscClear(); }catch(e){}
    gs._plFilter = null;
    gs.rerollsMax = REROLLS;
    gs.rerolls = 0;
    gs.shareRerollUsed = true;          /* no bonus reroll on the Daily */
    gs.dailyId = d;
    try{
      var rw = document.getElementById('rerollWrap');
      if(rw) rw.style.display = 'flex';
      renderRerolls();
    }catch(e2){}
    if(typeof pxSeedRun === 'function') pxSeedRun(seed(d));
    try{ if(typeof syncUIFromCfg === 'function') syncUIFromCfg(); }catch(e3){}
  }

  /* --------------------------------------------- recording today's result */
  function record(){
    var d = gs.dailyId;
    if(!d) return null;
    if(saved(d)) return saved(d);
    var r = {
      d: d,
      no: d - EPOCH + 1,
      pts: gs.pts || 0,
      fin: gs.finish || 20,
      ovr: Math.round((typeof squadAvg === 'function' ? squadAvg(null) : 0) || 0),
      w: gs.wins || 0, dr: gs.draws || 0, l: gs.losses || 0,
      gf: gs.gf || 0, ga: gs.ga || 0,
      grid: grid(gs.matchResults),
      streak: PXP.streak || 0,
      at: Date.now()
    };
    try{ localStorage.setItem(key(d), JSON.stringify(r)); }catch(e){}
    try{ pxpProgress('d_daily', 1); pxpProgress('w_daily', 1); }catch(e2){}
    try{
      PXP.dailyPlayed = (PXP.dailyPlayed || 0) + 1;
      if(r.pts > (PXP.dailyBest || 0)) PXP.dailyBest = r.pts;
      pxpSave();
    }catch(e3){}
    submit(r);
    return r;
  }

  /* Ask the server how the rest of the field did. Nothing here decides a
     score; the client only ever reports its own and reads back a
     distribution. A failure is silent: the Daily still works offline. */
  function submit(r){
    if(!window.MP || !MP.on()) return;
    MP.boot().then(function(){
      return MP.rpc('px_daily_submit', { p_day: r.d, p_pts: r.pts, p_fin: r.fin, p_ovr: r.ovr });
    }).then(function(res){
      if(!res || !res.ok) return;
      r.pct = res.pct; r.n = res.n; r.top = res.top;
      r.unbeaten = res.unbeaten; r.avg = res.avg;
      try{ localStorage.setItem(key(r.d), JSON.stringify(r)); }catch(e){}
      paintCohort(r);
    }).catch(function(){ /* offline or not configured: no percentile, no fuss */ });
  }

  function paintCohort(r){
    var el = document.getElementById('pxDailyCohort');
    if(el) el.innerHTML = cohortHtml(r);
    var el2 = document.getElementById('pxDailySrCohort');
    if(el2) el2.innerHTML = cohortHtml(r);
  }
  function cohortHtml(r){
    if(r.pct == null || !r.n || r.n < 2) return '';
    return '<div class="dl-pct"><b>' + r.pct + '%</b><span>of today’s ' +
      r.n.toLocaleString() + ' managers finished below you</span></div>' +
      (r.unbeaten ? '<div class="dl-note">' + r.unbeaten +
        ' went unbeaten today</div>' : '');
  }

  /* --------------------------------------------------------- the screen */
  function ensureScreen(){
    var el = document.getElementById('pxDaily');
    if(el) return el;
    el = document.createElement('div');
    el.id = 'pxDaily';
    el.className = 'screen';
    el.style.overflowY = 'auto';
    el.innerHTML =
      '<div class="hdr"><div class="hl">' +
      '<button class="home-btn" onclick="show(\'home\')">&#8592; Home</button></div>' +
      '<div class="hr-row"><span class="hl-v" id="pxDailyHdr"></span></div></div>' +
      '<div class="wrap" id="pxDailyBody"></div>';
    document.body.appendChild(el);
    return el;
  }

  function open(){
    ensureScreen();
    render();
    show('pxDaily');
  }

  function render(){
    var b = document.getElementById('pxDailyBody');
    if(!b) return;
    var h = document.getElementById('pxDailyHdr');
    if(h) h.textContent = 'Daily #' + no();
    var r = saved();
    var out = '';

    out += '<div class="dl-hero">' +
      '<span class="dl-kick">Same spins for everyone · one go a day</span>' +
      '<b class="dl-no">DAILY #' + no() + '</b>' +
      '<span class="dl-sub">' + dateLabel() + '</span></div>';

    out += streakCard();

    if(r){
      out += '<div class="dl-res">' +
        '<div class="dl-res-top"><span>Your result</span><b>' + ordinal(r.fin) + '</b></div>' +
        '<div class="dl-res-grid">' +
          cell('Points', r.pts) + cell('Won', r.w) + cell('Drawn', r.dr) +
          cell('Lost', r.l) + cell('For', r.gf) + cell('Against', r.ga) +
        '</div>' +
        (r.grid ? '<pre class="dl-grid">' + r.grid + '</pre>' : '') +
        '<div id="pxDailyCohort">' + cohortHtml(r) + '</div>' +
        '</div>';
      out += '<button class="dl-btn primary" onclick="PXDAILY.copy()">' +
             '&#128203; Copy your result</button>';
      out += '<div class="dl-next">Next Daily in <b id="pxDailyCd">' +
             (typeof pxpNextResetTxt === 'function' ? pxpNextResetTxt() : '') +
             '</b></div>';
      if(r.pct == null) submit(r);     /* retry the percentile if it missed */
    } else {
      out += '<div class="dl-brief">' +
        '<div class="dl-brief-r"><span>Formation</span><b>' + formation() + '</b></div>' +
        '<div class="dl-brief-r"><span>Rerolls</span><b>' + REROLLS + '</b></div>' +
        '<div class="dl-brief-r"><span>Era</span><b>1992–2026</b></div>' +
        '<div class="dl-brief-r"><span>Attempts</span><b>One</b></div>' +
        '</div>';
      out += '<button class="dl-btn primary" onclick="PXDAILY.start()">' +
             'Play Daily #' + no() + '</button>';
      out += '<div class="dl-note c">Everyone gets these exact spins today. ' +
             'There is no second go, so think about it.</div>';
    }

    out += history();
    b.innerHTML = out;
  }

  function cell(l, v){
    return '<div class="dl-c"><b>' + v + '</b><span>' + l + '</span></div>';
  }
  function dateLabel(){
    var d = new Date();
    var M = ['January','February','March','April','May','June','July',
             'August','September','October','November','December'];
    return d.getDate() + ' ' + M[d.getMonth()] + ' ' + d.getFullYear();
  }
  function streakCard(){
    var n = PXP.streak || 0, sh = (PXP.shields || 0) > 0;
    var rep = (typeof pxpRepairable === 'function') ? pxpRepairable() : 0;
    var out = '<div class="dl-streak' + (n ? ' on' : '') + '">' +
      '<span class="dl-fire">' + (n ? '🔥' : '⚽') + '</span>' +
      '<div class="dl-streak-b"><b>' +
        (n ? n + '-day streak' : 'No streak yet') + '</b><span>' +
        (n ? (sh ? 'Shield ready · one missed day is covered'
                 : 'Shield used · a new one next week')
           : 'Finish any season today to start one') +
      '</span></div>' +
      (PXP.streakBest > n ? '<span class="dl-best">best ' + PXP.streakBest + '</span>' : '') +
      '</div>';
    if(rep){
      out += '<button class="dl-btn ghost" onclick="PXDAILY.repair()">' +
        'Restore your ' + rep + '-day streak · free</button>';
    }
    return out;
  }
  function history(){
    var rows = [], d = day(), i, r;
    for(i = 1; i <= 7; i++){
      r = saved(d - i);
      if(r) rows.push(r);
    }
    if(!rows.length) return '';
    var out = '<div class="dl-sec">THE LAST WEEK</div>';
    rows.forEach(function(x){
      out += '<div class="dl-hrow"><span>#' + x.no + '</span>' +
        '<b>' + ordinal(x.fin) + '</b>' +
        '<span class="dl-hpts">' + x.pts + ' pts</span></div>';
    });
    return out;
  }

  /* ------------------------------------------------------- the home card */
  function homeCard(){
    var host = document.getElementById('pxDailyHome');
    if(!host) return;
    var r = saved(), n = PXP.streak || 0;
    var k = r ? 'Played today' : 'Today’s draft';
    var sub = r
      ? 'You finished ' + ordinal(r.fin) + ' on ' + r.pts + ' pts. Next one in ' +
        (typeof pxpNextResetTxt === 'function' ? pxpNextResetTxt() : 'the morning') + '.'
      : 'The same spins for every player in the world. One go.';
    host.innerHTML =
      '<button class="hm-card c-daily" onclick="PXDAILY.open()">' +
      '<span class="hm-ic">' + (r ? '✅' : '📅') + '</span>' +
      '<span class="hm-b"><span class="hm-k">' + k + '</span>' +
      '<span class="hm-t">Daily #' + no() + '</span>' +
      '<span class="hm-s">' + sub + '</span></span>' +
      (n ? '<span class="hm-streak">🔥' + n + '</span>'
         : '<span class="hm-arr">&#8250;</span>') +
      '</button>';
  }

  /* ------------------------------------------- the season-review addition */
  function reviewBlock(){
    if(!gs.dailyId) return '';
    var r = saved(gs.dailyId);
    if(!r) return '';
    return '<div class="dl-sr">' +
      '<div class="dl-sr-t">DAILY #' + r.no + '</div>' +
      (r.grid ? '<pre class="dl-grid">' + r.grid + '</pre>' : '') +
      '<div id="pxDailySrCohort">' + cohortHtml(r) + '</div>' +
      '<button class="dl-btn primary" onclick="PXDAILY.copy()">' +
      '&#128203; Copy your Daily result</button>' +
      '<div class="dl-note c">No player names in the share — it would give ' +
      'today’s wheel away.</div></div>';
  }

  function copy(){
    var r = saved();
    if(!r){ return; }
    r.streak = PXP.streak || 0;
    var txt = shareText(r);
    if(typeof pxCopyText === 'function'){ pxCopyText(txt, 'Daily result copied'); return; }
    try{ navigator.clipboard.writeText(txt); }catch(e){ window.prompt('Copy:', txt); }
  }
  function repair(){
    if(typeof pxpRepairStreak !== 'function') return;
    if(pxpRepairStreak()) render();
  }

  window.PXDAILY = {
    start: start, open: open, render: render, copy: copy, repair: repair,
    record: record, homeCard: homeCard, reviewBlock: reviewBlock,
    no: no, day: day, seed: seed, played: played, saved: saved,
    formation: formation
  };

  /* the inline script declares these as stubs; take them over */
  window.pxDailyId   = function(){ return day(); };
  window.pxDailyKey  = function(){ return key(); };
  window.pxStartDaily = start;
  window.pxDailyGrid = function(){ return grid(gs.matchResults); };
  window.pxShareDaily = function(){ copy(); };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', homeCard);
  } else {
    homeCard();
  }
})();
