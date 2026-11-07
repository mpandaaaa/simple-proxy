/* =====================================================================
   CHAMPIONS LEAGUE
   Your drafted XI takes one of the 36 places in the real league phase.
   Eight games, one table. Top 8 go straight to the last 16, 9th to 24th
   play a two-legged play-off, 25th to 36th are out. Then two-legged ties
   to the final, which is one match.
   Uses the same goal model as the World Cup so results are consistent.
   ===================================================================== */
var UCL_KEY='pxi_ucl_v1';

function uclSave(s){try{localStorage.setItem(UCL_KEY,JSON.stringify(s));}catch(e){}}
function uclLoad(){try{var r=localStorage.getItem(UCL_KEY);return r?JSON.parse(r):null;}catch(e){return null;}}
function uclClear(){try{localStorage.removeItem(UCL_KEY);}catch(e){}}

function uclMyRating(){
  var pl=(gs.squad||[]).filter(function(s){return s.player;});
  if(pl.length<11)return 0;
  var t=0;for(var i=0;i<pl.length;i++)t+=pl[i].player.rtg;
  return t/pl.length;
}
function uclHasXI(){return (gs.squad||[]).filter(function(s){return s.player;}).length>=11;}

/* ---- the draw ----
   Circle method: with an even field this produces perfect rounds where
   every team plays exactly once. Take the first 8 rounds and each club
   has 8 different opponents, four at home. Building it round by round is
   what guarantees no fixture is ever played twice.                      */
function uclDraw(names){
  var n=names.length, rounds=[], i, r;
  /* Circle method gives eight perfect rounds: every club plays once per
     round and never meets the same opponent twice. */
  var fixed=names[0], rot=names.slice(1);
  for(r=0;r<8;r++){
    var round=[{a:fixed,b:rot[0]}];
    for(i=1;i<n/2;i++) round.push({a:rot[i], b:rot[rot.length-i]});
    rounds.push(round);
    rot.unshift(rot.pop());
  }
  /* Home and away is an orientation problem. Every club has exactly eight
     fixtures, an even degree, so the fixture graph always has an Eulerian
     circuit. Walking it and pointing each edge the way you travelled
     leaves every club with exactly four home and four away. Greedy
     assignment cannot promise that; this can.                           */
  var adj={}, edges=[];
  for(i=0;i<n;i++)adj[names[i]]=[];
  for(r=0;r<rounds.length;r++)for(i=0;i<rounds[r].length;i++){
    var e={u:rounds[r][i].a,v:rounds[r][i].b,r:r,i:i,used:false};
    edges.push(e);
    adj[e.u].push(e); adj[e.v].push(e);
  }
  var ptr={};
  for(i=0;i<n;i++)ptr[names[i]]=0;
  for(var st=0;st<n;st++){
    var start=names[st];
    if(ptr[start]>=adj[start].length)continue;
    var stack=[start];
    while(stack.length){
      var node=stack[stack.length-1];
      while(ptr[node]<adj[node].length && adj[node][ptr[node]].used) ptr[node]++;
      if(ptr[node]>=adj[node].length){ stack.pop(); continue; }
      var ed=adj[node][ptr[node]];
      ed.used=true;
      /* travelling node -> other, so node hosts */
      var other = ed.u===node ? ed.v : ed.u;
      rounds[ed.r][ed.i]={h:node, a:other};
      stack.push(other);
    }
  }
  return rounds;
}

/* ---- one match, same model the World Cup uses ---- */
function uclGoals(att,def,home){
  var xg=1.25*Math.exp((att-def+(home?2.6:0))/22);
  xg=Math.max(0.18,Math.min(4.2,xg));
  return poissonR(xg);
}
function uclPlay(aR,bR){
  return {a:uclGoals(aR,bR,true), b:uclGoals(bR,aR,false)};
}

function uclSquadOf(k){return (typeof UCL_SQUADS!=='undefined'&&UCL_SQUADS[k])||[];}
function uclClubRating(k){
  var sq=uclSquadOf(k);
  if(sq.length>=11){
    var t=0;for(var i=0;i<11;i++)t+=sq[i].r;
    return Math.round(t/11);
  }
  return UCL_TEAMS[k]?UCL_TEAMS[k].r:72;   /* key players only: use the club rating */
}
/* choice = {t:'club', k:'Real Madrid'}  or  {t:'xi'} */
function uclStart(choice){
  choice=choice||{t:'xi'};
  var myR, myName, myKey=null;
  if(choice.t==='club'){
    myKey=choice.k; myR=uclClubRating(myKey); myName=uclName(myKey);
  } else {
    if(!uclHasXI())return null;
    myR=Math.round(uclMyRating()); myName='Your XI';
  }
  var names=Object.keys(UCL_TEAMS).sort(function(a,b){return UCL_TEAMS[b].r-UCL_TEAMS[a].r;});
  /* whoever you picked is one of the 36, so they are not also an opponent */
  names=names.filter(function(n){return n!==myKey;}).slice(0,35);
  var all=names.concat(['__ME__']);
  var s={
    pick:choice, me:{r:myR,n:myName,k:myKey},
    teams:{}, fx:uclDraw(all), played:0, stage:'league', ko:null, out:false, won:false, log:[]
  };
  for(var i=0;i<names.length;i++)s.teams[names[i]]={r:UCL_TEAMS[names[i]].r};
  s.teams['__ME__']={r:myR};
  s.tab={};
  for(i=0;i<all.length;i++)s.tab[all[i]]={p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0};
  uclSave(s);
  return s;
}

function uclRating(s,k){return k==='__ME__'?s.me.r:(s.teams[k]?s.teams[k].r:70);}
function uclName(k){
  if(k==='__ME__'){var d=uclLoad();return (d&&d.me&&d.me.n)||'Your XI';}
  return UCL_TEAMS[k]?UCL_TEAMS[k].n:k;
}
function uclFlag(k){
  if(k==='__ME__'){var d=uclLoad();
    if(d&&d.me&&d.me.k&&UCL_TEAMS[d.me.k])return UCL_TEAMS[d.me.k].f;
    return '\u2B50';}
  return UCL_TEAMS[k]?UCL_TEAMS[k].f:'\uD83C\uDFF3';
}

/* play one round for everybody, so the table stays honest */
function uclRound(s){
  if(s.played>=8)return null;
  var round=s.fx[s.played], mine=null;
  for(var i=0;i<round.length;i++){
    var h=round[i].h, a=round[i].a;
    var res=uclPlay(uclRating(s,h),uclRating(s,a));
    uclApply(s,h,a,res.a,res.b);
    if(h==='__ME__'||a==='__ME__'){
      mine={home:h,away:a,hg:res.a,ag:res.b,
            opp:(h==='__ME__'?a:h),wasHome:(h==='__ME__')};
    }
  }
  s.played++;
  if(mine)s.log.push(mine);
  if(s.played>=8)s.stage='knockout-seed';
  uclSave(s);
  return mine;
}
function uclApply(s,h,a,hg,ag){
  var H=s.tab[h],A=s.tab[a];
  H.p++;A.p++;H.gf+=hg;H.ga+=ag;A.gf+=ag;A.ga+=hg;
  if(hg>ag){H.w++;A.l++;H.pts+=3;}
  else if(hg<ag){A.w++;H.l++;A.pts+=3;}
  else{H.d++;A.d++;H.pts++;A.pts++;}
}
function uclTable(s){
  return Object.keys(s.tab).map(function(k){
    var t=s.tab[k];return {k:k,p:t.p,w:t.w,d:t.d,l:t.l,gf:t.gf,ga:t.ga,gd:t.gf-t.ga,pts:t.pts};
  }).sort(function(x,y){
    return y.pts-x.pts || y.gd-x.gd || y.gf-x.gf || uclRating(s,y.k)-uclRating(s,x.k);
  });
}
function uclMyPos(s){
  var t=uclTable(s);
  for(var i=0;i<t.length;i++)if(t[i].k==='__ME__')return i+1;
  return 36;
}

/* ---- knockouts ---- */
function uclBuildKO(s){
  var t=uclTable(s), pos=uclMyPos(s);
  if(pos>24){s.out=true;s.stage='done';uclSave(s);return;}
  s.ko={round:(pos<=8?'R16':'PO'),leg:1,agg:{me:0,opp:0},opp:null,history:[]};
  s.stage='knockout';
  uclNextOpp(s);
  uclSave(s);
}
var UCL_ROUNDS={PO:'Play-off',R16:'Last 16',QF:'Quarter-final',SF:'Semi-final',F:'Final'};
function uclNextOpp(s){
  var t=uclTable(s), pos=uclMyPos(s), band;
  if(s.ko.round==='PO')      band=t.slice(8,24);
  else if(s.ko.round==='R16')band=t.slice(0,24);
  else if(s.ko.round==='QF') band=t.slice(0,16);
  else if(s.ko.round==='SF') band=t.slice(0,12);
  else                        band=t.slice(0,8);
  band=band.filter(function(x){return x.k!=='__ME__';});
  s.ko.opp=band[Math.floor(Math.random()*band.length)].k;
  s.ko.leg=1;s.ko.agg={me:0,opp:0};
}
function uclPlayLeg(s){
  var myR=s.me.r, oppR=uclRating(s,s.ko.opp);
  var final=(s.ko.round==='F');
  var meHome=final?false:(s.ko.leg===1);
  var r=meHome?uclPlay(myR,oppR):uclPlay(oppR,myR);
  var mg=meHome?r.a:r.b, og=meHome?r.b:r.a;
  s.ko.agg.me+=mg;s.ko.agg.opp+=og;
  var rec={round:s.ko.round,leg:s.ko.leg,me:mg,opp:og,oppK:s.ko.opp,home:meHome};
  s.ko.history.push(rec);
  var decided=final||s.ko.leg===2;
  if(!decided){s.ko.leg=2;uclSave(s);return {rec:rec,tieOver:false};}
  var through=s.ko.agg.me>s.ko.agg.opp;
  var pens=null;
  if(s.ko.agg.me===s.ko.agg.opp){
    pens=wcSimShootout(myR,oppR);
    through=pens.meScore>pens.oppScore;
  }
  rec.pens=pens;rec.agg={me:s.ko.agg.me,opp:s.ko.agg.opp};rec.through=through;
  if(!through){s.out=true;s.stage='done';uclSave(s);return {rec:rec,tieOver:true,through:false};}
  if(s.ko.round==='F'){s.won=true;s.stage='done';uclSave(s);return {rec:rec,tieOver:true,through:true,won:true};}
  var next={PO:'R16',R16:'QF',QF:'SF',SF:'F'};
  s.ko.round=next[s.ko.round];
  uclNextOpp(s);uclSave(s);
  return {rec:rec,tieOver:true,through:true};
}
function uclStatus(s){
  if(!s)return 'Not started';
  if(s.won)return 'Champions of Europe';
  if(s.out)return s.stage==='done'&&uclMyPos(s)>24?'Out in the league phase':'Knocked out';
  if(s.stage==='league')return 'League phase, '+s.played+' of 8 played';
  if(s.stage==='knockout-seed')return 'League phase complete, '+uclOrdinal(uclMyPos(s));
  if(s.ko)return UCL_ROUNDS[s.ko.round]+', leg '+s.ko.leg;
  return 'In progress';
}
function uclOrdinal(n){
  var sfx=['th','st','nd','rd'],v=n%100;
  return n+(sfx[(v-20)%10]||sfx[v]||sfx[0]);
}

/* ---------------- screens ---------------- */
function uclEnter(){
  /* no XI needed: you can take a real club instead */
  show('ucl');
  uclRender();
}
function uclRender(){
  var body=document.getElementById('uclBody');
  if(!body)return;
  var s=uclLoad();
  body.innerHTML='';
  if(!s){ uclIntro(body); return; }
  if(s.stage==='league'){ uclLeague(body,s); return; }
  if(s.stage==='knockout-seed'){ uclSeeded(body,s); return; }
  if(s.stage==='knockout'){ uclKnockout(body,s); return; }
  uclFinished(body,s);
}
function uclHero(t,sub,note){
  var h=mkEl('div','ucl-hero');
  h.appendChild(mkEl('small',null,t));
  h.appendChild(mkEl('b',null,sub));
  if(note)h.appendChild(mkEl('p',null,note));
  return h;
}
function uclBtn(label,fn,green){
  var b=mkEl('button','ucl-big'+(green?' g':''),label);
  b.onclick=fn;return b;
}
function uclIntro(body){
  var hero=mkEl('div','ucl-hero');
  hero.appendChild(mkEl('small',null,'2026/27 league phase'));
  hero.appendChild(mkEl('b',null,'Choose who you take'));
  hero.appendChild(mkEl('p',null,'Thirty six clubs, one table, eight games each. Top eight go straight to the last sixteen. Ninth to twenty fourth play a two legged play off. Below that you are out.'));
  body.appendChild(hero);

  /* your own XI first, when you have one */
  body.appendChild(mkEl('div','dy-sec-t','BUILD YOUR OWN'));
  if(uclHasXI()){
    var avg=Math.round(uclMyRating());
    var own=mkEl('button','ucl-pick own');
    own.innerHTML='<span class="ucl-pick-f">\u2B50</span>'+
      '<span class="ucl-pick-b"><span class="ucl-pick-n">Your drafted XI</span>'+
      '<span class="ucl-pick-s">Rated '+avg+' \u00b7 the team you built</span></span>'+
      '<span class="ucl-pick-r">'+avg+'</span>';
    own.onclick=function(){uclStart({t:'xi'});uclRender();};
    body.appendChild(own);
  } else {
    var no=mkEl('div','ucl-empty');
    no.innerHTML='<b>No XI drafted yet</b><span>Draft one and it can take a place in the league phase.</span>';
    var go=mkEl('button','ucl-big g','Start a draft');
    go.onclick=function(){show('ss');};
    body.appendChild(no); body.appendChild(go);
  }

  body.appendChild(mkEl('div','dy-sec-t','OR TAKE A REAL CLUB'));
  var note=mkEl('div','ucl-note','Thirty six clubs qualified. Pick one and play their season.');
  body.appendChild(note);

  var keys=Object.keys(UCL_TEAMS).sort(function(a,b){
    return UCL_TEAMS[b].r-UCL_TEAMS[a].r;
  });
  var pot=0;
  for(var i=0;i<keys.length;i++){
    (function(k){
      var t=UCL_TEAMS[k];
      if(t.p!==pot){pot=t.p;body.appendChild(mkEl('div','ucl-pot','Pot '+pot));}
      var sq=uclSquadOf(k);
      var b=mkEl('button','ucl-pick');
      b.innerHTML='<span class="ucl-pick-f">'+t.f+'</span>'+
        '<span class="ucl-pick-b"><span class="ucl-pick-n">'+t.n+'</span>'+
        '<span class="ucl-pick-s">'+t.c+' \u00b7 '+sq.length+' players</span></span>'+
        '<span class="ucl-pick-r">'+uclClubRating(k)+'</span>';
      b.onclick=function(){uclConfirm(k);};
      body.appendChild(b);
    })(keys[i]);
  }
}

/* a look at the squad before you commit */
function uclConfirm(k){
  var body=document.getElementById('uclBody');
  if(!body)return;
  body.innerHTML='';
  var t=UCL_TEAMS[k], sq=uclSquadOf(k), r=uclClubRating(k);
  var back=mkEl('button','ucl-back','\u2039 All clubs');
  back.onclick=function(){uclRender();};
  body.appendChild(back);

  var hero=mkEl('div','ucl-hero');
  hero.appendChild(mkEl('small',null,t.c+' \u00b7 pot '+t.p));
  hero.appendChild(mkEl('b',null,t.f+'  '+t.n));
  hero.appendChild(mkEl('p',null,'Rated '+r+' from a squad of '+sq.length+'.'));
  body.appendChild(hero);

  var go=mkEl('button','ucl-big g','Take '+t.n+' into Europe');
  go.onclick=function(){uclStart({t:'club',k:k});uclRender();};
  body.appendChild(go);

  body.appendChild(mkEl('div','dy-sec-t','SQUAD'));
  for(var i=0;i<sq.length;i++){
    var p=sq[i];
    var row=mkEl('div','ucl-pl');
    row.innerHTML='<span class="ucl-pl-p p-'+p.p+'">'+p.p+'</span>'+
      '<span class="ucl-pl-n">'+p.n+'</span>'+
      '<span class="ucl-pl-r">'+p.r+'</span>';
    body.appendChild(row);
  }
}

function uclLeague(body,s){
  body.appendChild(uclHero('League phase',s.played+' of 8 played',
    s.played?null:'Your first fixture is waiting.'));
  if(s.log.length){
    body.appendChild(mkEl('div','dy-sec-t','YOUR RESULTS'));
    for(var i=s.log.length-1;i>=0;i--){
      var m=s.log[i];
      var mine=m.wasHome?m.hg:m.ag, theirs=m.wasHome?m.ag:m.hg;
      var cls=mine>theirs?'w':(mine<theirs?'l':'d');
      var row=mkEl('div','ucl-res '+cls);
      row.appendChild(mkEl('span','f',uclFlag(m.opp)));
      row.appendChild(mkEl('span','n',(m.wasHome?'vs ':'away to ')+uclName(m.opp)));
      row.appendChild(mkEl('span','s',mine+' - '+theirs));
      body.appendChild(row);
    }
  }
  if(s.played<8){
    body.appendChild(uclBtn('Play matchday '+(s.played+1),function(){
      uclRound(s);uclRender();
    },true));
    body.appendChild(uclBtn('Play all remaining',function(){
      while(s.played<8)uclRound(s);uclRender();
    }));
  }
  uclTableEl(body,s);
}
function uclTableEl(body,s){
  body.appendChild(mkEl('div','dy-sec-t','THE TABLE'));
  var t=uclTable(s);
  var tb=mkEl('table','ucl-tab');
  var hr=mkEl('tr');
  ['#','Club','P','W','D','L','GD','Pts'].forEach(function(h){hr.appendChild(mkEl('th',null,h));});
  tb.appendChild(hr);
  for(var i=0;i<t.length;i++){
    var r=t[i], tr=mkEl('tr');
    var cls=(i<8?'q8':(i<24?'qpo':'qout'));
    tr.className=cls+(r.k==='__ME__'?' me':'');
    [String(i+1),uclName(r.k),r.p,r.w,r.d,r.l,(r.gd>0?'+':'')+r.gd,r.pts].forEach(function(v){
      tr.appendChild(mkEl('td',null,String(v)));
    });
    tb.appendChild(tr);
  }
  body.appendChild(tb);
  var k=mkEl('div','ucl-key');
  k.innerHTML='<span style="color:#4CA0FF"><i>1-8</i> straight to the last 16</span>'+
              '<span style="color:#D6B25E"><i>9-24</i> play-off</span>'+
              '<span style="color:#E5484D"><i>25-36</i> out</span>';
  body.appendChild(k);
}
function uclSeeded(body,s){
  var pos=uclMyPos(s);
  var ko=mkEl('div','ucl-ko');
  ko.appendChild(mkEl('small',null,'League phase complete'));
  ko.appendChild(mkEl('b',null,uclOrdinal(pos)+' of 36'));
  ko.appendChild(mkEl('div',null,pos<=8?'Straight through to the last sixteen.':
    (pos<=24?'Into the two legged play off.':'Eliminated.')));
  body.appendChild(ko);
  body.appendChild(uclBtn(pos>24?'See the final table':'Into the knockouts',function(){
    uclBuildKO(s);uclRender();
  },pos<=24));
  uclTableEl(body,s);
}
function uclKnockout(body,s){
  var r=s.ko;
  var ko=mkEl('div','ucl-ko');
  ko.appendChild(mkEl('small',null,UCL_ROUNDS[r.round]));
  ko.appendChild(mkEl('b',null,uclName(r.opp)));
  if(r.round!=='F'){
    ko.appendChild(mkEl('div',null,'Leg '+r.leg+' of 2'+
      (r.leg===2?'  \u00b7  aggregate '+r.agg.me+' - '+r.agg.opp:'')));
  } else ko.appendChild(mkEl('div',null,'One match. Neutral ground.'));
  body.appendChild(ko);
  body.appendChild(uclBtn('Play '+(r.round==='F'?'the final':'leg '+r.leg),function(){
    var out=uclPlayLeg(s);
    uclRender();
  },true));
  if(r.history.length){
    body.appendChild(mkEl('div','dy-sec-t','THE ROAD SO FAR'));
    uclHistory(body,s);
  }
}
function uclHistory(body,s){
  var h=s.ko?s.ko.history:[];
  for(var i=h.length-1;i>=0;i--){
    var x=h[i];
    var cls=x.me>x.opp?'w':(x.me<x.opp?'l':'d');
    var row=mkEl('div','ucl-res '+cls);
    row.appendChild(mkEl('span','f',uclFlag(x.oppK)));
    row.appendChild(mkEl('span','n',UCL_ROUNDS[x.round]+(x.round==='F'?'':' leg '+x.leg)+
      '  \u00b7  '+uclName(x.oppK)));
    row.appendChild(mkEl('span','s',x.me+' - '+x.opp));
    body.appendChild(row);
    if(x.pens){
      var p=mkEl('div','ucl-res d');
      p.appendChild(mkEl('span','f','\u26BD'));
      p.appendChild(mkEl('span','n','Penalties'));
      p.appendChild(mkEl('span','s',x.pens.meScore+' - '+x.pens.oppScore));
      body.appendChild(p);
    }
  }
}
function uclFinished(body,s){
  var ko=mkEl('div','ucl-ko');
  if(s.won){
    ko.style.borderColor='rgba(214,178,94,.5)';
    ko.appendChild(mkEl('small',null,'Champions of Europe'));
    ko.appendChild(mkEl('b',null,'\uD83C\uDFC6'));
    ko.appendChild(mkEl('div',null,'Your XI has won the Champions League.'));
  } else {
    var pos=uclMyPos(s);
    ko.appendChild(mkEl('small',null,'Your run is over'));
    ko.appendChild(mkEl('b',null,pos>24?uclOrdinal(pos)+' of 36':'Knocked out'));
    var last=s.ko&&s.ko.history.length?s.ko.history[s.ko.history.length-1]:null;
    ko.appendChild(mkEl('div',null,pos>24?'Eliminated in the league phase.':
      (last?'Beaten in the '+UCL_ROUNDS[last.round].toLowerCase()+'.':'')));
  }
  body.appendChild(ko);
  body.appendChild(uclBtn('Start a new run',function(){uclClear();uclRender();}));
  if(s.ko&&s.ko.history.length){
    body.appendChild(mkEl('div','dy-sec-t','THE KNOCKOUTS'));
    uclHistory(body,s);
  }
  uclTableEl(body,s);
}
/* keep the home tile honest */
function uclTileStatus(){
  var el=document.getElementById('uclTileSub');
  if(!el)return;
  var s=uclLoad();
  el.textContent = s ? ((s.me&&s.me.n?s.me.n:'Your XI')+' \u00b7 '+uclStatus(s))
                     : 'Take a real club or your own XI';
}
