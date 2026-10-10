/* Salvamento em IndexedDB (wrapper Promise próprio), com versão de esquema e migrações. */
(function (CP) {
  'use strict';

  var C = CP.C, W = CP.W;
  var S = { db: null, busy: false, lastSave: 0, slot: 'slot1' };

  /* migrações: de versão N para N+1 */
  S.MIGRATIONS = {
    // 1: function (save) { ...; save.version = 2; return save; }
  };
  S.migrate = function (save) {
    var v = save.version || 1;
    while (v < C.SCHEMA_VERSION) {
      var fn = S.MIGRATIONS[v];
      if (!fn) { throw new Error('Sem migração para a versão ' + v); }
      save = fn(save);
      v = save.version;
    }
    return save;
  };

  function req2p(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  S.open = function () {
    if (S.db) { return Promise.resolve(S.db); }
    return new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error('IndexedDB indisponível')); return; }
      var r = indexedDB.open(C.DB_NAME, C.DB_VERSION);
      r.onupgradeneeded = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains('saves')) { db.createObjectStore('saves'); }
        if (!db.objectStoreNames.contains('chunks')) { db.createObjectStore('chunks'); }
        if (!db.objectStoreNames.contains('settings')) { db.createObjectStore('settings'); }
      };
      r.onsuccess = function () { S.db = r.result; res(S.db); };
      r.onerror = function () { rej(r.error); };
    });
  };
  function tx(stores, mode) { return S.db.transaction(stores, mode); }
  function done(t) { return new Promise(function (res, rej) { t.oncomplete = function () { res(); }; t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error || new Error('abortado')); }; }); }

  /* ---------- serialização ---------- */
  function plain(obj) { return JSON.parse(JSON.stringify(obj, function (k, v) { return typeof v === 'function' ? undefined : v; })); }
  S.serializeChunk = function (ch) {
    return {
      cx: ch.cx, cy: ch.cy, type: ch.type, townId: ch.townId,
      levels: ch.levels, rooms: ch.rooms, buildings: ch.buildings, edges: ch.edges,
      containers: ch.containers, items: ch.items, zombies: ch.zombies,
      corpses: ch.corpses.map(function (c) { return { x: c.x, y: c.y, z: c.z, ang: c.ang, look: c.look, items: c.items, t: c.t, zombie: c.zombie }; }),
      crops: ch.crops, water: ch.water, fires: ch.fires, decals: ch.decals || [], seen: ch.seen || null, foraged: ch.foraged || null,
      cars: (ch.cars || []).map(function (c) { var o = {}; for (var k in c) { if (k !== 'draw' && k !== 'kind' && k !== 'bright') { o[k] = c[k]; } } return o; }), carsConverted: !!ch.carsConverted,
      initialZ: ch.initialZ || 0, lastActive: ch.lastActive || 0
    };
  };
  S.deserializeChunk = function (d) {
    var ch = W.newChunk(d.cx, d.cy);
    for (var k in d) { if (k !== 'cx' && k !== 'cy') { ch[k] = d[k]; } }
    ch.active = false; ch.dirty = false;
    return ch;
  };

  /* ---------- salvar ---------- */
  S.save = function () {
    var G = CP.Game;
    if (!G.state || !G.player || G.player.dead || S.busy) { return Promise.resolve(false); }
    S.busy = true;
    var p = G.player;
    var veh = p.vehicle;
    p.vehicleId = veh ? veh.id : null;
    p.vehicle = null;
    var record = {
      version: C.SCHEMA_VERSION, savedAt: Date.now(),
      meta: { name: p.name, occupation: p.occupation, days: CP.Time.daysSurvived(), kills: G.state.kills, town: (W.macro.towns[0] || {}).name },
      state: plain(G.state), player: plain(p), settings: plain(G.settings),
      zombies: G.zombies.map(function (z) { return plain(CP.Zombies.toData(z)); })
    };
    p.vehicle = veh;
    var chunks = W.allChunks().filter(function (c) { return c.saveDirty || c.active; });
    return S.open().then(function () {
      var t = tx(['saves', 'chunks'], 'readwrite');
      t.objectStore('saves').put(record, S.slot);
      var cs = t.objectStore('chunks');
      chunks.forEach(function (ch) {
        // zumbis ativos já vão em record.zombies; o chunk ativo guarda lista vazia
        cs.put(S.serializeChunk(ch), S.slot + ':' + ch.cx + ',' + ch.cy);
      });
      return done(t);
    }).then(function () {
      chunks.forEach(function (ch) { if (!ch.active) { ch.saveDirty = false; } });
      S.busy = false; S.lastSave = Date.now();
      return true;
    }).catch(function (e) { S.busy = false; console.error('Erro ao salvar', e); if (CP.UI) { CP.UI.toast('Erro ao salvar: ' + e.message, 'danger'); } return false; });
  };

  S.hasSave = function () {
    return S.open().then(function () { return req2p(tx(['saves'], 'readonly').objectStore('saves').get(S.slot)); }).then(function (r) { return r || null; }).catch(function () { return null; });
  };

  /* ---------- carregar ---------- */
  S.load = function () {
    var G = CP.Game;
    var record;
    return S.open().then(function () { return req2p(tx(['saves'], 'readonly').objectStore('saves').get(S.slot)); }).then(function (r) {
      if (!r) { throw new Error('Nenhum jogo salvo.'); }
      record = S.migrate(r);
      W.init(record.state.seed);
      return new Promise(function (res, rej) {
        var t = tx(['chunks'], 'readonly');
        var range = IDBKeyRange.bound(S.slot + ':', S.slot + ':￿');
        var cur = t.objectStore('chunks').openCursor(range);
        cur.onsuccess = function () {
          var c = cur.result;
          if (c) { var ch = S.deserializeChunk(c.value); W.grid[ch.cy * C.WORLD_CHUNKS + ch.cx] = ch; c.continue(); } else { res(); }
        };
        cur.onerror = function () { rej(cur.error); };
      });
    }).then(function () {
      G.settings = Object.assign({}, G.settings, record.settings || {});
      G.state = record.state;
      var p = record.player;
      p.draw = CP.Player.draw;
      p.action = null; p.queue = []; p.sleeping = false; p.anim = { phase: 0, attack: 0, shove: 0 };
      G.player = p;
      G.zombies = (record.zombies || []).map(function (d) { return CP.Zombies.fromData(d); });
      G.effects = []; G.texts = []; G.activeChunks = {};
      // chunks que estavam ativos: marcar já ativos (seus zumbis estão em record.zombies)
      if (CP.Vehicles) { CP.Vehicles.reset(); }
      G.afterLoad();
      if (p.vehicleId && CP.Vehicles) { p.vehicle = CP.Vehicles.active.filter(function (c) { return c.id === p.vehicleId; })[0] || null; }
      return record;
    });
  };

  S.deleteSave = function () {
    return S.open().then(function () {
      var t = tx(['saves', 'chunks'], 'readwrite');
      t.objectStore('saves').delete(S.slot);
      t.objectStore('chunks').delete(IDBKeyRange.bound(S.slot + ':', S.slot + ':￿'));
      return done(t);
    }).catch(function () { /* sem save */ });
  };

  S.saveSettings = function (obj) {
    return S.open().then(function () { var t = tx(['settings'], 'readwrite'); t.objectStore('settings').put(obj, 'prefs'); return done(t); }).catch(function () {});
  };
  S.loadSettings = function () {
    return S.open().then(function () { return req2p(tx(['settings'], 'readonly').objectStore('settings').get('prefs')); }).catch(function () { return null; });
  };

  CP.Save = S;
})(window.CP = window.CP || {});
