/* =====================================================================
   PERFECT XI  ·  DURABLE PROGRESS
   ---------------------------------------------------------------------
   Everything a player earns - level, streak, collection, ascension tier
   - lives in one localStorage key. Safari with cross-site tracking
   prevention on deletes ALL of an origin's script-created storage after
   seven days of browser use without interaction on that origin, and the
   deletion is all-or-nothing. navigator.storage.persist() is documented
   as NOT preventing that particular purge.

   So: someone who plays every Saturday loses their streak, their
   collection and their ascension tier, silently, over and over. This
   file mirrors the blob to Supabase under the anonymous identity the
   multiplayer client already mints, and hands the player a recovery
   code so a new phone keeps their progress.

   Last write wins by timestamp, and the player is asked before anything
   of theirs is overwritten.
   ===================================================================== */
(function(){
  'use strict';

  var LOCAL_AT = 'pxi_meta_at';     /* when this device last changed the blob */
  var CODE_KEY = 'pxi_recovery';
  var pending = null, timer = null, lastSent = '';

  function stamp(){
    try{ localStorage.setItem(LOCAL_AT, String(Date.now())); }catch(e){}
  }
  function localAt(){
    try{ return parseInt(localStorage.getItem(LOCAL_AT) || '0', 10) || 0; }catch(e){ return 0; }
  }
  function code(){
    try{ return localStorage.getItem(CODE_KEY) || ''; }catch(e){ return ''; }
  }
  function setCode(c){
    try{ if(c) localStorage.setItem(CODE_KEY, c); }catch(e){}
  }

  /* Chromium and Firefox honour this under disk pressure. Safari does not
     exempt a persisted origin from the seven-day purge, which is exactly
     why the server mirror above exists rather than instead of it. */
  function askPersist(){
    try{
      if(navigator.storage && navigator.storage.persist &&
         navigator.storage.persisted){
        navigator.storage.persisted().then(function(already){
          if(!already) navigator.storage.persist();
        });
      }
    }catch(e){}
  }

  function blob(){
    try{ return JSON.parse(JSON.stringify(PXP)); }catch(e){ return null; }
  }

  /* -------------------------------------------------------------- upload */
  function push(){
    if(!window.MP || !MP.on()) return;
    var b = blob();
    if(!b) return;
    var j = JSON.stringify(b);
    if(j === lastSent) return;            /* nothing actually changed */
    lastSent = j;
    MP.saveProgress(b).then(function(res){
      if(res && res.ok && res.code) setCode(res.code);
    }).catch(function(){ lastSent = ''; });   /* let the next change retry */
  }
  function schedule(){
    stamp();
    if(timer) clearTimeout(timer);
    timer = setTimeout(function(){ timer = null; push(); }, 4000);
  }

  /* ------------------------------------------------------------ download */
  function merge(remote){
    if(!remote || !remote.blob) return;
    var r = remote.blob;
    var remoteAt = Date.parse(remote.updated_at || 0) || 0;
    var mine = localAt();
    var richer = (r.seasons || 0) > (PXP.seasons || 0) ||
                 (r.streakBest || 0) > (PXP.streakBest || 0) ||
                 Object.keys(r.collected || {}).length >
                   Object.keys(PXP.collected || {}).length;

    /* A brand-new device has nothing to lose, so just take the server copy. */
    if(!mine || !(PXP.seasons || 0)){
      adopt(r);
      return;
    }
    /* This device is behind AND the server copy is plainly fuller: ask.
       Silently flattening somebody's collection is unforgivable. */
    if(remoteAt > mine + 60000 && richer){
      offer(r, remoteAt);
    }
  }
  function adopt(r){
    try{
      for(var k in r) if(Object.prototype.hasOwnProperty.call(r, k)) PXP[k] = r[k];
      if(typeof pxpRollMissions === 'function') pxpRollMissions();
      if(typeof pxpSave === 'function') pxpSave();
      stamp();
      lastSent = JSON.stringify(blob());
      if(typeof pxHomeCards === 'function') pxHomeCards();
      if(window.PXDAILY) PXDAILY.homeCard();
    }catch(e){}
  }
  function offer(r, at){
    var when = new Date(at);
    var msg = 'There is newer Perfect XI progress saved to your account:\n\n' +
      '  level ' + (r.lvl || 1) + ', ' + (r.seasons || 0) + ' seasons, ' +
      Object.keys(r.collected || {}).length + ' players collected\n' +
      '  last played ' + when.toLocaleDateString() + '\n\n' +
      'This device has level ' + (PXP.lvl || 1) + ', ' + (PXP.seasons || 0) +
      ' seasons.\n\nLoad the newer one?';
    try{ if(window.confirm(msg)) adopt(r); else push(); }catch(e){}
  }

  function pull(){
    if(!window.MP || !MP.on()) return;
    MP.loadProgress().then(function(row){
      if(!row){ push(); return; }        /* first ever sync: seed the server */
      if(row.code) setCode(row.code);
      merge(row);
    }).catch(function(){});
  }

  /* -------------------------------------------------------- recovery code */
  function restore(c){
    c = String(c || '').trim().toUpperCase();
    if(!c) return Promise.reject(new Error('Enter your code'));
    if(!window.MP || !MP.on()) return Promise.reject(new Error('Not online'));
    return MP.claimProgress(c).then(function(res){
      if(!res || !res.ok) throw new Error(res && res.why === 'no such code'
        ? 'No progress found for that code' : 'Could not restore');
      adopt(res.blob);
      push();
      return res;
    });
  }

  /* ------------------------------------------------------------- wiring */
  function hook(){
    if(typeof pxpSave !== 'function') return;
    var orig = window.pxpSave;
    window.pxpSave = function(){
      var out = orig.apply(this, arguments);
      schedule();
      return out;
    };
  }

  window.PXSYNC = {
    code: code, restore: restore, push: push, pull: pull,
    persist: askPersist,
    /* shown on the Progress screen so a player can write it down */
    codeLine: function(){
      var c = code();
      return c ? c : 'Play a season to get your recovery code';
    }
  };

  function boot(){
    hook();
    askPersist();
    /* give the anonymous sign-in a moment; nothing here is urgent */
    setTimeout(pull, 2500);
    window.addEventListener('pagehide', function(){ push(); });
    document.addEventListener('visibilitychange', function(){
      if(document.visibilityState === 'hidden') push();
    });
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
