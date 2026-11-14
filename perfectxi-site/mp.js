/* =====================================================================
   PERFECT XI MULTIPLAYER
   Two ways to play together:
     LIVE     everyone in a room drafts at once against a clock, each
              from their own spins, then all the squads go into ONE
              league and the same season plays out for everybody.
     LEAGUES  asynchronous. Same draw, play when you like.
   Identity is anonymous. Scores are written by the server, never here.
   ===================================================================== */
var MP = (function(){
  var sb=null, me=null, ready=false, booting=null;
  function on(){ return window.PXI_MP && window.PXI_MP.ON(); }

  function lib(){
    return new Promise(function(res,rej){
      if(window.supabase&&window.supabase.createClient)return res(window.supabase);
      var s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
      s.onload=function(){res(window.supabase);};
      s.onerror=function(){rej(new Error('Could not load multiplayer'));};
      document.head.appendChild(s);
    });
  }
  function boot(){
    if(booting)return booting;
    booting=new Promise(function(res,rej){
      if(!on())return rej(new Error('not configured'));
      lib().then(function(S){
        sb=S.createClient(window.PXI_MP.URL,window.PXI_MP.KEY,
          {auth:{persistSession:true,autoRefreshToken:true}});
        return sb.auth.getSession();
      }).then(function(r){
        if(r&&r.data&&r.data.session)return r.data.session;
        return sb.auth.signInAnonymously().then(function(x){
          if(x.error)throw x.error; return x.data.session;
        });
      }).then(function(sess){ me=sess.user; ready=true; res(true); }).catch(rej);
    });
    return booting;
  }
  function name(){ return localStorage.getItem('pxi_mp_name')||'Manager'; }
  function setName(n){
    n=String(n||'').trim().slice(0,18);
    if(n.length<2)throw new Error('Name is too short');
    localStorage.setItem('pxi_mp_name',n); return n;
  }
  function code(){
    var A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',s='';
    for(var i=0;i<6;i++)s+=A[Math.floor(Math.random()*A.length)];
    return s;
  }

  /* ---------------- live rooms ---------------- */
  function createRoom(opts){
    opts=opts||{};
    var row={code:code(),host:me.id,seed:Math.floor(Math.random()*2147483647),
      draft_secs:opts.secs||180, formation:opts.formation||'4-3-3',
      era_from:opts.from||1992, era_to:opts.to||2026, prime:!!opts.prime,
      cpu_count:opts.cpu||0, cpu_level:opts.level||'mixed'};
    return sb.from('rooms').insert(row).select().single().then(function(r){
      if(r.error)throw r.error;
      return sb.rpc('join_room',{join_code:r.data.code,player_name:name()})
        .then(function(){return r.data;});
    });
  }
  function joinRoom(c){
    return sb.rpc('join_room',{join_code:String(c).trim().toUpperCase(),player_name:name()})
      .then(function(r){
        if(r.error)throw new Error(r.error.message||'Could not join');
        return sb.from('rooms').select('*').eq('id',r.data).single();
      }).then(function(r){ if(r.error)throw r.error; return r.data; });
  }
  function room(id){
    return sb.from('rooms').select('*').eq('id',id).single()
      .then(function(r){ if(r.error)throw r.error; return r.data; });
  }
  function roomPlayers(id){
    return sb.from('room_players').select('*').eq('room_id',id).order('seat')
      .then(function(r){ return r.data||[]; });
  }
  function updateRoom(id,patch){
    return sb.from('rooms').update(patch).eq('id',id);
  }
  function startDraft(id,secs){
    return sb.from('rooms')
      .update({state:'drafting',draft_secs:secs,started_at:new Date().toISOString()})
      .eq('id',id).select().maybeSingle()
      .then(function(r){
        if(r.error)throw new Error(r.error.message);
        if(!r.data)throw new Error('the room would not change state');
        return r.data;
      });
  }
  function submitRoomPicks(id,picks){
    return sb.from('room_players').update({picks:picks,ready:true})
      .eq('room_id',id).eq('user_id',me.id).select().maybeSingle()
      .then(function(r){ if(r.error)throw new Error(r.error.message); return r.data; });
  }
  function simulateRoom(id){
    return sb.functions.invoke('simulate-room',{body:{room_id:id}});
  }
  function watchRoom(id,cb){
    var ch=sb.channel('room:'+id)
      .on('postgres_changes',{event:'*',schema:'public',table:'rooms',filter:'id=eq.'+id},cb)
      .on('postgres_changes',{event:'*',schema:'public',table:'room_players',filter:'room_id=eq.'+id},cb)
      .subscribe();
    return function(){ try{sb.removeChannel(ch);}catch(e){} };
  }

  /* ---------------- async leagues ---------------- */
  function createLeague(nm,opts){
    opts=opts||{};
    var row={code:code(),name:String(nm).trim().slice(0,30),owner:me.id,
      seed:Math.floor(Math.random()*2147483647),
      formation:opts.formation||'4-3-3',era_from:opts.from||1992,era_to:opts.to||2026};
    return sb.from('leagues').insert(row).select().single().then(function(r){
      if(r.error)throw r.error;
      return sb.from('members').insert({league_id:r.data.id,user_id:me.id})
        .then(function(){return r.data;});
    });
  }
  function joinLeague(c){
    return sb.rpc('join_league',{join_code:String(c).trim().toUpperCase()})
      .then(function(r){
        if(r.error)throw new Error('No league with that code');
        return sb.from('leagues').select('*').eq('id',r.data).single();
      }).then(function(r){ if(r.error)throw r.error; return r.data; });
  }
  function myLeagues(){
    return sb.from('members').select('league_id, leagues(*)').eq('user_id',me.id)
      .then(function(r){ return (r.data||[]).map(function(x){return x.leagues;}).filter(Boolean); });
  }
  function league(id){
    return sb.from('leagues').select('*').eq('id',id).single()
      .then(function(r){ if(r.error)throw r.error; return r.data; });
  }
  function leagueTable(id){
    return sb.from('league_table').select('*').eq('league_id',id)
      .order('position',{ascending:true}).then(function(r){ return r.data||[]; });
  }
  function myRun(id){
    return sb.from('runs').select('*').eq('league_id',id).eq('user_id',me.id).maybeSingle()
      .then(function(r){ return r.data||null; });
  }
  function submitRun(leagueId,seed,picks){
    return sb.from('runs').insert({league_id:leagueId,user_id:me.id,seed:seed,picks:picks})
      .select().single().then(function(r){
        if(r.error){
          if(String(r.error.message||'').indexOf('duplicate')>=0)
            throw new Error('You have already played this league');
          throw r.error;
        }
        return sb.functions.invoke('score-run',{body:{run_id:r.data.id}})
          .then(function(){return r.data;}).catch(function(){return r.data;});
      });
  }
  /* ---------------- plain RPC + durable progress ---------------- */
  function rpc(fn,args){
    return boot().then(function(){
      return sb.rpc(fn,args||{});
    }).then(function(r){
      if(r.error)throw new Error(r.error.message||'rpc failed');
      return r.data;
    });
  }
  /* Safari deletes all of an origin's localStorage after seven days with no
     interaction, all or nothing, and persist() is documented NOT to stop it.
     So the meta-progress blob is mirrored under the anonymous identity we
     already hold, and a recovery code brings it back on a new phone. */
  function saveProgress(blob){ return rpc('px_progress_save',{p_blob:blob}); }
  function loadProgress(){
    return boot().then(function(){
      return sb.from('px_progress').select('blob,code,updated_at')
        .eq('user_id',me.id).maybeSingle();
    }).then(function(r){
      if(r.error)throw r.error;
      return r.data||null;
    });
  }
  function claimProgress(code){ return rpc('px_progress_claim',{p_code:code}); }

  function ensureProfile(){
    return sb.from('profiles').upsert({id:me.id,name:name()});
  }
  function watchLeague(id,cb){
    var ch=sb.channel('lg:'+id)
      .on('postgres_changes',{event:'*',schema:'public',table:'runs',filter:'league_id=eq.'+id},cb)
      .subscribe();
    return function(){ try{sb.removeChannel(ch);}catch(e){} };
  }

  return {on:on,boot:boot,ready:function(){return ready;},uid:function(){return me&&me.id;},
    name:name,setName:setName,ensureProfile:ensureProfile,
    rpc:rpc,saveProgress:saveProgress,loadProgress:loadProgress,claimProgress:claimProgress,
    createRoom:createRoom,joinRoom:joinRoom,room:room,roomPlayers:roomPlayers,
    updateRoom:updateRoom,startDraft:startDraft,submitRoomPicks:submitRoomPicks,
    simulateRoom:simulateRoom,watchRoom:watchRoom,
    createLeague:createLeague,joinLeague:joinLeague,myLeagues:myLeagues,league:league,
    leagueTable:leagueTable,myRun:myRun,submitRun:submitRun,watchLeague:watchLeague};
})();
