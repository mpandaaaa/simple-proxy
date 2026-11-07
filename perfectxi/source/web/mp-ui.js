/* =====================================================================
   MULTIPLAYER SCREENS
   ===================================================================== */
function mpEnter(){ show('mp'); mpRender(); }
/* go straight into a room. mpEnter would repaint the hub a moment later
   and wipe the room off the screen, which is what made finishing a draft
   look like nothing happened. */
function mpGo(id){ show('mp'); var b=mpBody(); if(b)b.innerHTML=''; mpRoom(id); }
function mpBody(){ return document.getElementById('mpBody'); }
function esc(s){return String(s).replace(/[<>&"]/g,function(c){
  return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c];});}
function mpCard(t,s){
  var d=mkEl('div','mp-empty'); d.appendChild(mkEl('b',null,t));
  if(s)d.appendChild(mkEl('span',null,s)); return d;
}
function mpBtn(label,fn,kind){
  var b=mkEl('button','mp-btn'+(kind?' '+kind:''),label); b.onclick=fn; return b;
}
var _mpStop=null, _mpSent={}, _mpCredited={};
var MP_ACTIVE='pxi_mp_room';
function mpRemember(id){ try{localStorage.setItem(MP_ACTIVE,id||'');}catch(e){} }
function mpForget(){ try{localStorage.removeItem(MP_ACTIVE);}catch(e){} }
function mpActive(){ try{return localStorage.getItem(MP_ACTIVE)||'';}catch(e){return '';} }
function mpDrop(){ if(_mpStop){_mpStop();_mpStop=null;}
  if(typeof _mpPoll!=='undefined'&&_mpPoll){clearInterval(_mpPoll);_mpPoll=null;} }

function mpRender(){
  var body=mpBody(); if(!body)return;
  mpDrop(); _mpSent={}; body.innerHTML='';
  if(!MP.on()){
    var h=mkEl('div','mp-hero');
    h.appendChild(mkEl('small',null,'Multiplayer'));
    h.appendChild(mkEl('b',null,'Not set up yet'));
    body.appendChild(h); return;
  }
  body.appendChild(mpCard('Connecting\u2026'));
  MP.boot().then(function(){
    MP.ensureProfile();
    var back=mpActive();
    if(back){
      /* a room was left open. rejoin it rather than dumping them here. */
      return MP.room(back).then(function(R){
        if(R&&R.state!=='done'){ body.innerHTML=''; mpRoom(back); return; }
        mpForget(); body.innerHTML=''; mpHub(body);
      }).catch(function(){ mpForget(); body.innerHTML=''; mpHub(body); });
    }
    body.innerHTML=''; mpHub(body);
  })
    .catch(function(e){ body.innerHTML='';
      body.appendChild(mpCard('Could not connect',String(e.message||e)));
      body.appendChild(mpBtn('Try again',mpRender)); });
}

function mpHub(body){
  var h=mkEl('div','mp-hero');
  h.appendChild(mkEl('small',null,'Multiplayer'));
  h.appendChild(mkEl('b',null,'Play your mates'));
  body.appendChild(h);

  /* ---- quick play: the default, because waiting is the mode's enemy ---- */
  var q=mkEl('button','mp-quick');
  q.innerHTML='<span class="mp-quick-k">Quick play</span>'+
    '<span class="mp-quick-t">Start right now</span>'+
    '<span class="mp-quick-s">A full table of eight, three minutes on the clock. '+
    'Invite your mates while you draft and they drop straight in.</span>'+
    '<span class="mp-quick-go">Start a game \u203a</span>';
  q.onclick=mpQuick;
  body.appendChild(q);

  /* ---- live ---- */
  var live=mkEl('div','mp-mode m-live');
  live.innerHTML='<span class="mp-mode-k">Live</span>'+
    '<span class="mp-mode-t">Draft together</span>'+
    '<span class="mp-mode-s">Everyone drafts at once against a clock, each from their own spins. '+
    'Then all the squads go into one league and you watch the same season play out.</span>';
  body.appendChild(live);
  var r1=mkEl('div','mp-row2');
  r1.appendChild(mpBtn('Set your own rules',mpHost));
  r1.appendChild(mpBtn('Join with a code',function(){mpJoinRoom();}));
  body.appendChild(r1);

  /* ---- async ---- */
  var lg=mkEl('div','mp-mode m-lg');
  lg.innerHTML='<span class="mp-mode-k">Leagues</span>'+
    '<span class="mp-mode-t">Play in your own time</span>'+
    '<span class="mp-mode-s">Everyone gets the same draw and plays whenever suits. '+
    'Best season tops the table.</span>';
  body.appendChild(lg);
  var r2=mkEl('div','mp-row2');
  r2.appendChild(mpBtn('Create a league',mpCreateLeague));
  r2.appendChild(mpBtn('Join with a code',function(){mpJoinLeague();}));
  body.appendChild(r2);

  body.appendChild(mkEl('div','dy-sec-t','YOUR LEAGUES'));
  var list=mkEl('div'); body.appendChild(list);
  MP.myLeagues().then(function(ls){
    list.innerHTML='';
    if(!ls.length){ list.appendChild(mpCard('No leagues yet','Create one and send the link.')); return; }
    ls.forEach(function(L){
      var b=mkEl('button','mp-league');
      b.innerHTML='<span class="mp-league-b"><span class="mp-league-n">'+esc(L.name)+'</span>'+
        '<span class="mp-league-s">Code '+L.code+'</span></span><span class="mp-league-a">&#8250;</span>';
      b.onclick=function(){mpLeague(L.id);};
      list.appendChild(b);
    });
  });
  var nm=mkEl('div','mp-name');
  nm.innerHTML='<span>Playing as</span><b>'+esc(MP.name())+'</b>';
  nm.onclick=function(){
    var n=prompt('What should the table call you?',MP.name());
    if(!n)return;
    try{MP.setName(n);MP.ensureProfile();mpRender();}catch(e){alert(e.message);}
  };
  body.appendChild(nm);
}

/* One tap to a live game: make the room, fill the rest of the table with CPU
   managers and start the clock. No lobby to sit in on your own. */
function mpQuick(){
  var body=mpBody(); mpDrop(); body.innerHTML='';
  body.appendChild(mpCard('Setting up your game\u2026','Three minutes on the clock.'));
  MP.createRoom({secs:180,from:1992,to:2026,prime:true,formation:'4-3-3',
                 cpu:7,level:'mixed'})
    .then(function(R){
      return MP.startDraft(R.id,180).then(function(){ return R; });
    })
    .then(function(R){ mpRoom(R.id); })
    .catch(function(e){
      body.innerHTML='';
      body.appendChild(mpCard('Could not start',String(e.message||e)));
      body.appendChild(mpBtn('Back',mpRender));
    });
}

/* ================= LIVE ROOM ================= */
function mpHost(){
  var body=mpBody(); mpDrop(); body.innerHTML='';
  var back=mkEl('button','ucl-back','\u2039 Back'); back.onclick=mpRender;
  body.appendChild(back);
  var h=mkEl('div','mp-hero');
  h.appendChild(mkEl('small',null,'Live'));
  h.appendChild(mkEl('b',null,'Set the rules'));
  h.appendChild(mkEl('p',null,'You pick the era and the clock. Everyone drafts from their own spins.'));
  body.appendChild(h);

  var st={secs:180,from:1992,to:2026,prime:false,formation:'4-3-3',cpu:0,level:'mixed'};
  var panel=mkEl('div'); body.appendChild(panel);

  function group(label,vals,key,note){
    panel.appendChild(mkEl('div','dy-sec-t',label));
    var row=mkEl('div','mp-opts');
    vals.forEach(function(v){
      var b=mkEl('button','mp-opt'+(st[key]===v[1]?' on':''),v[0]);
      b.onclick=function(){ st[key]=v[1]; draw(); };
      row.appendChild(b);
    });
    panel.appendChild(row);
    if(note)panel.appendChild(mkEl('div','mp-note',note));
  }
  function draw(){
    panel.innerHTML='';
    group('TIME TO DRAFT',[['2 min',120],['3 min',180],['5 min',300]],'secs');
    group('ERA',[['All time',1992],['2000s',2000],['2010s',2010],['Modern',2016]],'from');
    group('RATINGS',[['That season',false],['Prime',true]],'prime');
    group('FORMATION',[['4-3-3','4-3-3'],['4-4-2','4-4-2'],['4-2-3-1','4-2-3-1'],['3-5-2','3-5-2']],'formation');
    group('CPU MANAGERS',[['None',0],['2',2],['4',4],['6',6],['9',9]],'cpu',
      st.cpu?('They draft their own squads and show as CPU in the table.'):
             ('Add some if there are only a few of you.'));
    if(st.cpu)group('CPU STRENGTH',
      [['Easy','easy'],['Mixed','mixed'],['Hard','hard']],'level',
      st.level==='hard'?'They will finish above you more often than not.':
      st.level==='easy'?'Comfortably beatable.':'Pitched around the room.');
    panel.appendChild(mpBtn('Create the room',function(){
      body.innerHTML=''; body.appendChild(mpCard('Creating\u2026'));
      MP.createRoom(st).then(function(R){ mpRoom(R.id); })
        .catch(function(e){ body.innerHTML='';
          body.appendChild(mpCard('Could not create',String(e.message||e)));
          body.appendChild(mpBtn('Back',mpRender)); });
    },'g'));
  }
  draw();
}
function mpJoinRoom(c){
  var code=c||prompt('Enter the six character code');
  if(!code)return;
  var body=mpBody(); mpDrop(); body.innerHTML='';
  body.appendChild(mpCard('Joining\u2026'));
  MP.joinRoom(code).then(function(R){ mpRoom(R.id); })
    .catch(function(e){ body.innerHTML='';
      body.appendChild(mpCard('Could not join',String(e.message||e)));
      body.appendChild(mpBtn('Back',mpRender)); });
}

var _mpTick=null, _mpPoll=null, _mpPaint=null;
function mpRoom(id){
  var body=mpBody(); if(!body)return;
  mpRemember(id);
  mpDrop(); if(_mpTick){clearInterval(_mpTick);_mpTick=null;}
  body.innerHTML='';
  var wrap=mkEl('div'); body.appendChild(wrap);

  function paint(){
    Promise.all([MP.room(id),MP.roomPlayers(id)]).then(function(r){
      var R=r[0],P=r[1];
      if(R.state==='done'){
        if(R.matches_json&&!(_mpSeason&&_mpSeason.id===id)){ mpDrop(); mpSeasonStart(id,R); return; }
        if(_mpSeason&&_mpSeason.id===id){ mpDrop(); return; }   /* playback owns the screen */
        mpReview(id,R,P); return;
      }
      if(R.state==='drafting'){ mpDrafting(id,R,P,wrap); return; }
      mpLobby(id,R,P,wrap);
    }).catch(function(e){
      wrap.innerHTML=''; wrap.appendChild(mpCard('Lost the room',String(e.message||e)));
    });
  }
  _mpPaint=paint;
  paint();
  _mpStop=MP.watchRoom(id,paint);
  /* realtime can drop or be blocked on some networks, so poll gently too */
  if(_mpPoll)clearInterval(_mpPoll);
  _mpPoll=setInterval(paint,2500);
}
function mpStopPoll(){ if(_mpPoll){clearInterval(_mpPoll);_mpPoll=null;} _mpPaint=null; }

function mpLobby(id,R,P,wrap){
  wrap.innerHTML='';
  var back=mkEl('button','ucl-back','\u2039 Leave'); back.onclick=function(){mpForget();mpDrop();mpRender();};
  wrap.appendChild(back);
  var h=mkEl('div','mp-hero');
  h.appendChild(mkEl('small',null,'Waiting to start'));
  h.appendChild(mkEl('b',null,'The lobby'));
  h.appendChild(mkEl('p',null,R.formation+' \u00b7 '+R.era_from+' to '+R.era_to+
    ' \u00b7 '+(R.prime?'prime ratings':'season ratings')+' \u00b7 '+Math.round(R.draft_secs/60)+' min'+
    (R.cpu_count?' \u00b7 '+R.cpu_count+' CPU':'')));
  wrap.appendChild(h);

  var cd=mkEl('div','mp-code'); cd.innerHTML='<span>Room code</span><b>'+R.code+'</b>';
  wrap.appendChild(cd);
  wrap.appendChild(mpBtn('Copy the invite link',function(){
    var url=location.origin+'/?room='+R.code;
    if(navigator.share)navigator.share({title:'Perfect XI',text:'Join my game',url:url}).catch(function(){});
    else if(typeof pxCopyText==='function')pxCopyText(url,'Link copied');
    else{try{navigator.clipboard.writeText(url);alert('Link copied');}catch(e){prompt('Copy this',url);}}
  }));

  wrap.appendChild(mkEl('div','dy-sec-t','IN THE ROOM \u00b7 '+P.length+' OF 8'));
  P.forEach(function(p){
    var row=mkEl('div','mp-seat');
    row.innerHTML='<span class="mp-seat-n">'+esc(p.name)+
      (p.user_id===R.host?' <i>host</i>':'')+(p.user_id===MP.uid()?' <b>you</b>':'')+'</span>'+
      '<span class="mp-seat-s">in</span>';
    wrap.appendChild(row);
  });

  if(R.host===MP.uid()){
    var go=mpBtn(P.length<2?'Start now':'Start the draft',function(){
      go.disabled=true; go.textContent='Starting\u2026';
      MP.startDraft(id,R.draft_secs).then(function(res){
        if(res&&res.error){
          go.disabled=false; go.textContent='Start the draft';
          alert('Could not start: '+(res.error.message||'permission denied'));
          return;
        }
        if(_mpPaint)_mpPaint();          /* do not wait on realtime */
      }).catch(function(e){
        go.disabled=false; go.textContent='Start the draft';
        alert('Could not start: '+(e.message||e));
      });
    },'g');
    wrap.appendChild(go);
    if(P.length<2)wrap.appendChild(mkEl('div','mp-note',
      R.cpu_count?('Start whenever you like \u2014 '+R.cpu_count+
        ' CPU managers are already in, and anyone you invite can join mid-draft.')
      :'Start whenever you like. Anyone you invite can join while you draft.'));
  } else {
    wrap.appendChild(mpCard('Waiting for the host','They start the clock when everyone is in.'));
  }
}

function mpDrafting(id,R,P,wrap){
  var mine=P.filter(function(p){return p.user_id===MP.uid();})[0];
  var done=P.filter(function(p){return p.ready;}).length;
  var ends=new Date(R.started_at).getTime()+R.draft_secs*1000;

  /* if I have not started drafting yet, go and draft */
  if(mine&&!mine.ready&&!gs.mpRoom&&!_mpSent[id]){
    gs.mpRoom={id:id,ends:ends};
    cfg.formation=R.formation;
    cfg.rtype=R.prime?'prime':'career';
    if(typeof cfg.eraFrom!=='undefined'){cfg.eraFrom=R.era_from;cfg.eraTo=R.era_to;}
    mpDrop();
    startDraft();
    mpClock(ends);
    return;
  }
  wrap.innerHTML='';
  /* you walked away mid-draft: offer the way back in */
  if(mine&&!mine.ready&&!_mpSent[id]&&gs.mpRoom&&gs.mpRoom.id===id){
    var res=mkEl('div','mp-hero');
    res.appendChild(mkEl('small',null,'Drafting'));
    res.appendChild(mkEl('b',null,'Your squad is not in yet'));
    wrap.appendChild(res);
    wrap.appendChild(mpBtn('Back to your draft',function(){
      mpDrop(); mpClock(ends); show('sd');
    },'g'));
  }
  var allIn=done>=P.length&&done>0;
  var h=mkEl('div','mp-hero');
  h.appendChild(mkEl('small',null,allIn?'Squads in':'Drafting'));
  h.appendChild(mkEl('b',null,allIn?'Every squad is in'
                                  :(done+' of '+P.length+' ready')));
  h.appendChild(mkEl('p',null,allIn
    ?('The season is being played now'+(R.cpu_count?' against '+R.cpu_count+
        ' CPU managers and the rest of the division.':'.'))
    :'Waiting for everyone to finish their XI.'));
  wrap.appendChild(h);
  P.forEach(function(p){
    var row=mkEl('div','mp-seat'+(p.ready?' ok':''));
    row.innerHTML='<span class="mp-seat-n">'+esc(p.name)+'</span>'+
      '<span class="mp-seat-s">'+(p.ready?'\u2713 squad in':'still picking\u2026')+'</span>';
    wrap.appendChild(row);
  });
  var late=Date.now()>ends+3000;
  if((done===P.length||late)&&done>0){
    var sim=mkEl('div','mp-simming');
    sim.innerHTML='<span class="mp-spin"></span>'+
      '<div><b>Playing the season</b><span>All the squads in one league. '+
      'This takes a few seconds.</span></div>';
    wrap.appendChild(sim);
  }
}

/* the clock that sits over the draft screen */
function mpClock(ends){
  if(_mpTick)clearInterval(_mpTick);
  var el=document.getElementById('mpClock');
  if(!el){
    el=document.createElement('div'); el.id='mpClock'; document.body.appendChild(el);
  }
  el.style.display='flex';
  function tick(){
    var left=Math.max(0,Math.round((ends-Date.now())/1000));
    var m=Math.floor(left/60), s=left%60;
    el.textContent=m+':'+(s<10?'0':'')+s;
    el.className=left<=30?'low':'';
    if(left<=0){ clearInterval(_mpTick); _mpTick=null; mpAutoFinish(); }
  }
  tick(); _mpTick=setInterval(tick,250);
}
function mpHideClock(){
  if(_mpTick){clearInterval(_mpTick);_mpTick=null;}
  var el=document.getElementById('mpClock'); if(el)el.style.display='none';
}
/* time is up: submit whatever is on the pitch, filling gaps with the best left */
function mpAutoFinish(){
  if(!gs.mpRoom)return;
  try{
    if(typeof autoFillRemaining==='function')autoFillRemaining();
  }catch(e){}
  mpSubmitRoom();
}
function mpSubmitRoom(){
  if(!gs.mpRoom){ return; }
  var R=gs.mpRoom;
  var picks=(gs.squad||[]).filter(function(s){return s.player;})
    .map(function(s){return {n:s.player.n,p:s.pos||(s.player.pos&&s.player.pos[0])||'MID'};});
  mpHideClock();
  if(!MP.on()||!MP.ready()){ gs.mpRoom=null; _mpSent[R.id]=true; mpGo(R.id); return; }
  if(picks.length<11){
    /* one last attempt to complete the XI before giving up on it */
    try{ autoFillRemaining(); }catch(e){}
    picks=(gs.squad||[]).filter(function(s){return s.player;})
      .map(function(s){return {n:s.player.n,p:s.pos||(s.player.pos&&s.player.pos[0])||'MID'};});
  }
  gs.mpRoom=null; _mpSent[R.id]=true;
  if(picks.length<11){
    mpGo(R.id);
    alert('Your squad was not complete, so it could not be entered.');
    return;
  }
  mpGo(R.id);                        /* show the room immediately */
  MP.submitRoomPicks(R.id,picks).then(function(){
    if(_mpPaint)_mpPaint();          /* reflect "squad in" without waiting */
  }).catch(function(e){
    alert('Could not send your squad: '+(e.message||e));
  });
}

function mpReview(id,R,P){
  try{
    if(!_mpCredited[id]){
      _mpCredited[id]=1;
      if(typeof pxpProgress==='function')pxpProgress('w_mp',1);
      if(typeof pxpTouchStreak==='function')pxpTouchStreak();
    }
  }catch(e){}
  mpForget();
  var body=mpBody(); body.innerHTML='';
  mpHideClock();
  var back=mkEl('button','ucl-back','\u2039 Multiplayer');
  back.onclick=function(){_mpSeason=null;mpForget();mpDrop();mpRender();};
  body.appendChild(back);

  var tab=R.table_json||[];
  var stats=R.stats_json||{};
  var mine=tab.filter(function(t){return t.user===MP.uid();})[0];
  var champ=tab[0];

  var h=mkEl('div','mp-hero');
  h.appendChild(mkEl('small',null,'Season review'));
  h.appendChild(mkEl('b',null,mine?('You finished '+mpOrd(mine.pos)):'Final table'));
  if(mine)h.appendChild(mkEl('p',null,mine.pts+' points \u00b7 '+mine.w+'W '+mine.d+'D '+mine.l+'L \u00b7 '+
    mine.gf+' scored, '+mine.ga+' conceded'));
  body.appendChild(h);

  /* champions */
  if(champ){
    var win=mkEl('div','mp-champ');
    win.innerHTML='<span class="mp-champ-k">Champions</span>'+
      '<span class="mp-champ-n">'+esc(champ.name)+'</span>'+
      '<span class="mp-champ-s">'+champ.pts+' points \u00b7 '+champ.w+' wins</span>';
    body.appendChild(win);
  }

  /* the awards */
  var sc=(stats.scorers||[]), cr=(stats.creators||[]), sh=(stats.sheets||[]);
  if(sc.length||cr.length){
    body.appendChild(mkEl('div','dy-sec-t','AWARDS'));
    var grid=mkEl('div','mp-awards');
    function award(icon,label,name,detail,ink){
      if(!name)return;
      var d=mkEl('div','mp-award');
      d.style.setProperty('--ink',ink);
      d.innerHTML='<span class="mp-award-i">'+icon+'</span>'+
        '<span class="mp-award-k">'+label+'</span>'+
        '<span class="mp-award-n">'+esc(name)+'</span>'+
        '<span class="mp-award-d">'+esc(detail)+'</span>';
      grid.appendChild(d);
    }
    if(sc[0])award('\u26BD','Golden Boot',sc[0].n,sc[0].g+' goals \u00b7 '+sc[0].team,'#D6B25E');
    if(cr[0])award('\uD83C\uDFAF','Playmaker',cr[0].n,cr[0].a+' assists \u00b7 '+cr[0].team,'#4CA0FF');
    if(sh[0])award('\uD83E\uDDE4','Golden Glove',sh[0].gk||sh[0].name,
      sh[0].cs+' clean sheets'+(sh[0].gk?' \u00b7 '+sh[0].name:''),'#1FC57E');
    body.appendChild(grid);
  }

  /* top scorers */
  if(sc.length){
    body.appendChild(mkEl('div','dy-sec-t','TOP SCORERS'));
    var t1=mkEl('table','ucl-tab'); var r1=mkEl('tr');
    ['#','Player','Team','G','A'].forEach(function(x){r1.appendChild(mkEl('th',null,x));});
    t1.appendChild(r1);
    sc.slice(0,10).forEach(function(p,i){
      var tr=mkEl('tr'); if(p.user===MP.uid())tr.className='me';
      [i+1,p.n,p.team,p.g,p.a].forEach(function(v){tr.appendChild(mkEl('td',null,String(v)));});
      t1.appendChild(tr);
    });
    body.appendChild(t1);
  }

  /* most assists */
  if(cr.length){
    body.appendChild(mkEl('div','dy-sec-t','MOST ASSISTS'));
    var t2=mkEl('table','ucl-tab'); var r2=mkEl('tr');
    ['#','Player','Team','A','G'].forEach(function(x){r2.appendChild(mkEl('th',null,x));});
    t2.appendChild(r2);
    cr.slice(0,10).forEach(function(p,i){
      var tr=mkEl('tr'); if(p.user===MP.uid())tr.className='me';
      [i+1,p.n,p.team,p.a,p.g].forEach(function(v){tr.appendChild(mkEl('td',null,String(v)));});
      t2.appendChild(tr);
    });
    body.appendChild(t2);
  }

  /* clean sheets */
  if(sh.length){
    body.appendChild(mkEl('div','dy-sec-t','CLEAN SHEETS'));
    sh.slice(0,6).forEach(function(x){
      var row=mkEl('div','mp-seat'+(x.user===MP.uid()?' ok':''));
      row.innerHTML='<span class="mp-seat-n">'+esc(x.name)+
        (x.gk?' <i>'+esc(x.gk)+'</i>':'')+'</span>'+
        '<span class="mp-seat-s">'+x.cs+'</span>';
      body.appendChild(row);
    });
  }

  /* the final table */
  body.appendChild(mkEl('div','dy-sec-t','FINAL TABLE'));
  var t=mkEl('table','ucl-tab');
  var hr=mkEl('tr');
  ['#','Team','P','W','D','L','GD','Pts'].forEach(function(x){hr.appendChild(mkEl('th',null,x));});
  t.appendChild(hr);
  tab.forEach(function(r){
    var tr=mkEl('tr');
    if(r.user===MP.uid())tr.className='me';
    else if(r.user)tr.className='rival';
    else if(r.cpu)tr.className='cpu';
    [r.pos,r.name,r.p,r.w,r.d,r.l,((r.gf-r.ga)>0?'+':'')+(r.gf-r.ga),r.pts]
      .forEach(function(v){tr.appendChild(mkEl('td',null,String(v)));});
    t.appendChild(tr);
  });
  body.appendChild(t);

  /* head to head */
  var h2h=R.h2h_json||{};
  var keys=Object.keys(h2h);
  if(keys.length){
    body.appendChild(mkEl('div','dy-sec-t','HEAD TO HEAD'));
    var nameOf={};
    tab.forEach(function(t2){ if(t2.user)nameOf[t2.user]=t2.name; });
    keys.forEach(function(k){
      var ab=k.split('|');
      h2h[k].forEach(function(g){
        var row=mkEl('div','mp-h2h');
        var w=g.hg>g.ag?0:(g.ag>g.hg?1:-1);
        row.innerHTML='<span class="'+(w===0?'win':'')+'">'+esc(nameOf[ab[0]]||'?')+'</span>'+
          '<b>'+g.hg+' - '+g.ag+'</b>'+
          '<span class="'+(w===1?'win':'')+'">'+esc(nameOf[ab[1]]||'?')+'</span>';
        body.appendChild(row);
      });
    });
  }

  body.appendChild(mpBtn('Back to multiplayer',function(){
    _mpSeason=null;mpForget();mpDrop();mpRender();}));
}
function mpOrd(n){var s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);}

/* ================= ASYNC LEAGUES ================= */
function mpCreateLeague(){
  var nm=prompt('Name your league','The Group Chat');
  if(!nm)return;
  var body=mpBody(); body.innerHTML=''; body.appendChild(mpCard('Creating\u2026'));
  MP.createLeague(nm,{formation:(typeof cfg!=='undefined'&&cfg.formation)||'4-3-3'})
    .then(function(L){ mpLeague(L.id); })
    .catch(function(e){ body.innerHTML='';
      body.appendChild(mpCard('Could not create',String(e.message||e)));
      body.appendChild(mpBtn('Back',mpRender)); });
}
function mpJoinLeague(c){
  var code=c||prompt('Enter the six character code');
  if(!code)return;
  var body=mpBody(); body.innerHTML=''; body.appendChild(mpCard('Joining\u2026'));
  MP.joinLeague(code).then(function(L){ mpLeague(L.id); })
    .catch(function(e){ body.innerHTML='';
      body.appendChild(mpCard('Could not join',String(e.message||e)));
      body.appendChild(mpBtn('Back',mpRender)); });
}
function mpLeague(id){
  var body=mpBody(); mpDrop(); body.innerHTML='';
  var back=mkEl('button','ucl-back','\u2039 Multiplayer'); back.onclick=mpRender;
  body.appendChild(back);
  var wrap=mkEl('div'); body.appendChild(wrap);
  function paint(){
    Promise.all([MP.league(id),MP.leagueTable(id),MP.myRun(id)]).then(function(r){
      var L=r[0],T=r[1],mine=r[2];
      wrap.innerHTML='';
      var h=mkEl('div','mp-hero');
      h.appendChild(mkEl('small',null,'League'));
      h.appendChild(mkEl('b',null,L.name));
      wrap.appendChild(h);
      var cd=mkEl('div','mp-code'); cd.innerHTML='<span>Invite code</span><b>'+L.code+'</b>';
      wrap.appendChild(cd);
      wrap.appendChild(mpBtn('Copy the invite link',function(){
        var url=location.origin+'/?league='+L.code;
        if(navigator.share)navigator.share({title:'Perfect XI',text:'Join my league',url:url}).catch(function(){});
        else if(typeof pxCopyText==='function')pxCopyText(url,'Link copied');
        else{try{navigator.clipboard.writeText(url);alert('Link copied');}catch(e){prompt('Copy this',url);}}
      }));
      if(mine){
        var d=mkEl('div','mp-done');
        d.innerHTML=mine.verified?('<b>'+mine.pts+' points</b><span>Position '+(mine.finish||'?')+'</span>')
          :'<b>Being scored</b><span>Refresh in a moment.</span>';
        wrap.appendChild(d);
      } else {
        wrap.appendChild(mpBtn('Play your season',function(){
          cfg.formation=L.formation;
          gs.mpLeague={id:L.id,seed:L.seed};
          if(typeof setSeed==='function')setSeed(L.seed);
          startDraft();
        },'g'));
      }
      wrap.appendChild(mkEl('div','dy-sec-t','THE TABLE'));
      if(!T.length){ wrap.appendChild(mpCard('Nobody has played yet','Be the first.')); }
      else{
        var t=mkEl('table','ucl-tab'); var hr=mkEl('tr');
        ['#','Manager','Pts','GF','GA'].forEach(function(x){hr.appendChild(mkEl('th',null,x));});
        t.appendChild(hr);
        T.forEach(function(r){
          var tr=mkEl('tr'); if(r.user_id===MP.uid())tr.className='me';
          [r.position,r.name,r.pts,r.gf,r.ga].forEach(function(v){
            tr.appendChild(mkEl('td',null,String(v==null?'-':v)));});
          t.appendChild(tr);
        });
        wrap.appendChild(t);
      }
    });
  }
  paint();
  _mpStop=MP.watchLeague(id,paint);
}

/* called by the game when a season finishes */
function mpFinish(){
  if(gs.mpRoom){ mpSubmitRoom(); return; }
  if(!gs.mpLeague||!MP.on()||!MP.ready())return;
  var picks=(gs.squad||[]).filter(function(s){return s.player;}).map(function(s){return s.player.n;});
  if(picks.length!==11)return;
  var L=gs.mpLeague; gs.mpLeague=null;
  MP.submitRun(L.id,L.seed,picks).catch(function(){});
}
/* the XI is complete during a live game: submit immediately, do not simulate here */
function mpSquadDone(){
  if(gs.mpRoom){ mpSubmitRoom(); return true; }
  return false;
}

/* =====================================================================
   TIME UP
   Fill whatever is still empty so a half-built XI can still be entered.
   The fillers are deliberately ordinary, so running out of time costs
   you something rather than handing you a free squad.
   ===================================================================== */
function autoFillRemaining(){
  if(typeof gs==='undefined'||!gs.squad)return 0;
  var empty=gs.squad.filter(function(s){return !s.player;}).length;
  if(!empty)return 0;

  var used={};
  gs.squad.forEach(function(s){ if(s.player)used[s.player.n]=1; });

  var prime=(typeof cfg!=='undefined'&&cfg.rtype==='prime');
  var pool={};                       /* keyed by whatever label the slot uses */
  var any=[];
  try{
    var keys=Object.keys(SQUADS);
    /* walk from a random point so the fillers are not always the same names */
    var start=Math.floor(Math.random()*keys.length);
    for(var n=0;n<keys.length;n++){
      var key=keys[(start+n)%keys.length];
      var arr=SQUADS[key]||[];
      for(var i=0;i<arr.length;i++){
        var p=arr[i];
        if(used[p.n])continue;
        var r=prime?(p.prime||p.rtg):p.rtg;
        if(r>78)continue;            /* nothing special handed out for free */
        var ps=(p.pos&&p.pos[0])||'MID';
        var rec={n:p.n,nat:p.nat||'',pos:[ps],rtg:r,
                 club:key.split('|')[0],season:key.split('|')[1]||''};
        (pool[ps]=pool[ps]||[]).push(rec);
        any.push(rec);
      }
      if(any.length>900)break;
    }
  }catch(e){}

  function take(want){
    var list=pool[want];
    while(list&&list.length){
      var p=list.splice(Math.floor(Math.random()*list.length),1)[0];
      if(p&&!used[p.n])return p;
    }
    /* that position is exhausted: anyone unused is better than a hole */
    while(any.length){
      var q=any.splice(Math.floor(Math.random()*any.length),1)[0];
      if(q&&!used[q.n])return q;
    }
    return null;
  }

  var filled=0;
  for(var s2=0;s2<gs.squad.length;s2++){
    var slot=gs.squad[s2];
    if(slot.player)continue;
    var pick=take(slot.pos||'MID');
    if(!pick)break;
    used[pick.n]=1;
    /* wear the shirt of the slot so the pitch renders correctly */
    slot.player={n:pick.n,nat:pick.nat,pos:[slot.pos||pick.pos[0]],
                 rtg:pick.rtg,club:pick.club,season:pick.season};
    filled++;
  }
  gs.filled=gs.squad.filter(function(x){return x.player;}).length;
  return filled;
}

if(typeof window!=='undefined'){
  window.mpSquadDone=mpSquadDone;
  window.mpFinish=mpFinish;
  window.mpEnter=mpEnter;
  window.mpGo=mpGo;
  window.mpJoinRoom=mpJoinRoom;
  window.mpJoinLeague=mpJoinLeague;
  window.autoFillRemaining=autoFillRemaining;
  window.mpRemember=mpRemember;
  window.mpForget=mpForget;
}

/* =====================================================================
   THE SEASON, MATCHDAY BY MATCHDAY
   The same shape as the solo game: results come in one matchday at a
   time with the table moving underneath. No minute by minute viewer,
   because in a room full of people nobody wants to sit through
   ninety minutes of someone else's match.
   ===================================================================== */
var _mpSeason=null;

function mpSeasonStart(id,R){
  var M=R.matches_json;
  if(!M||!M.days||!M.days.length){ mpReview(id,R,null); return; }
  _mpSeason={id:id,R:R,day:0,playing:false,
    teams:M.teams,days:M.days,
    tab:M.teams.map(function(t,i){
      return {i:i,name:t.name,user:t.user,cpu:t.cpu,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0};
    })};
  mpSeasonRender();
}
function mpApplyDay(S,d){
  d.forEach(function(m){
    var h=S.tab[m.h],a=S.tab[m.a];
    h.p++;a.p++;h.gf+=m.hg;h.ga+=m.ag;a.gf+=m.ag;a.ga+=m.hg;
    if(m.hg>m.ag){h.w++;a.l++;h.pts+=3;}
    else if(m.hg<m.ag){a.w++;h.l++;a.pts+=3;}
    else{h.d++;a.d++;h.pts++;a.pts++;}
  });
}
function mpSorted(S){
  return S.tab.slice().sort(function(x,y){
    return y.pts-x.pts||(y.gf-y.ga)-(x.gf-x.ga)||y.gf-x.gf;});
}
function mpSeasonRender(){
  var S=_mpSeason; if(!S)return;
  var body=mpBody(); if(!body)return;
  body.innerHTML='';

  var mine=S.tab.filter(function(t){return t.user===MP.uid();})[0];
  var h=mkEl('div','mp-hero');
  h.appendChild(mkEl('small',null,S.day>=S.days.length?'Season complete':'Matchday '+(S.day+1)+' of '+S.days.length));
  h.appendChild(mkEl('b',null,mine?mine.name:'The season'));
  if(mine){
    var ord=mpSorted(S); var pos=0;
    for(var i=0;i<ord.length;i++)if(ord[i].i===mine.i){pos=i+1;break;}
    h.appendChild(mkEl('p',null,mine.pts+' pts \u00b7 '+mine.w+'W '+mine.d+'D '+mine.l+'L \u00b7 '+
      (S.day?mpOrd(pos):'not started')));
  }
  body.appendChild(h);

  /* your own result, front and centre */
  if(S.day>0&&mine){
    var last=S.days[S.day-1];
    for(var k=0;k<last.length;k++){
      var m=last[k];
      if(m.h!==mine.i&&m.a!==mine.i)continue;
      var home=(m.h===mine.i);
      var me=home?m.hg:m.ag, them=home?m.ag:m.hg;
      var opp=S.teams[home?m.a:m.h];
      var cls=me>them?'w':(me<them?'l':'d');
      var row=mkEl('div','ucl-res '+cls);
      row.appendChild(mkEl('span','f',me>them?'\u2714':(me<them?'\u2716':'\u2013')));
      row.appendChild(mkEl('span','n',(home?'vs ':'away to ')+opp.name));
      row.appendChild(mkEl('span','s',me+' - '+them));
      body.appendChild(row);
    }
  }

  if(S.day<S.days.length){
    var one=mpBtn('Play matchday '+(S.day+1),function(){
      mpApplyDay(S,S.days[S.day]); S.day++; mpSeasonRender();
    },'g');
    body.appendChild(one);
    var all=mpBtn('Skip to the end',function(){
      while(S.day<S.days.length){ mpApplyDay(S,S.days[S.day]); S.day++; }
      mpSeasonRender();
    });
    body.appendChild(all);
  } else {
    body.appendChild(mpBtn('See the season review',function(){
      mpReview(S.id,S.R,null);
    },'g'));
  }

  /* the rest of the matchday */
  if(S.day>0){
    body.appendChild(mkEl('div','dy-sec-t','MATCHDAY '+S.day+' RESULTS'));
    S.days[S.day-1].forEach(function(m){
      var H=S.teams[m.h],A=S.teams[m.a];
      var row=mkEl('div','mp-fix'+((H.user||A.user)?' live':''));
      row.innerHTML='<span class="mp-fix-h">'+esc(H.name)+'</span>'+
        '<span class="mp-fix-s">'+m.hg+' - '+m.ag+'</span>'+
        '<span class="mp-fix-a">'+esc(A.name)+'</span>';
      body.appendChild(row);
    });
  }

  body.appendChild(mkEl('div','dy-sec-t','THE TABLE'));
  var t=mkEl('table','ucl-tab'); var hr=mkEl('tr');
  ['#','Team','P','W','D','L','GD','Pts'].forEach(function(x){hr.appendChild(mkEl('th',null,x));});
  t.appendChild(hr);
  mpSorted(S).forEach(function(r,i){
    var tr=mkEl('tr');
    if(r.user===MP.uid())tr.className='me';
    else if(r.user)tr.className='rival';
    else if(r.cpu)tr.className='cpu';
    [i+1,r.name,r.p,r.w,r.d,r.l,((r.gf-r.ga)>0?'+':'')+(r.gf-r.ga),r.pts]
      .forEach(function(v){tr.appendChild(mkEl('td',null,String(v)));});
    t.appendChild(tr);
  });
  body.appendChild(t);
}
