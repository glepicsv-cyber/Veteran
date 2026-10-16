// Người Đi Trước — trạng thái game, vòng lặp, hệ thống sinh tồn
'use strict';
const SAVE_KEY = 'ndt_save_v1', SNAP_KEY = 'ndt_snap_v1', META_KEY = 'ndt_meta_v1';

const G = {
  s: null, rt: {}, map: null, ground: null, ISL: null,
  p: { dir: 'd', anim: 0, moving: false },
  mo: { x: 0, y: 0, say: '', sayT: 0, hintT: 40 },
  cam: { x: 0, y: 0 }, zoom: 1, shakeT: 0, time: 0,
  target: null, busyA: null, paused: true,

  // ---------- Khởi tạo ----------
  newGame(o) {
    G.s = {
      v: 1, name: o.name || 'Minh', gender: o.gender || 'm', hard: !!o.hard, mods: o.mods || {},
      island: 1, phase: 'island', time: CFG.startTime,
      st: { hp: CFG.start.hp, hunger: CFG.start.hunger, thirst: CFG.start.thirst, sta: CFG.start.sta, heat: 0 },
      inv: new Array(20).fill(null), invSize: CFG.start.invSize,
      raft: 0, raftBroken: false, deco: {},
      pages: {}, relics: {}, flags: {}, counts: {}, side: {},
      parrot: { fed: 0, friend: false }, light: null, deaths: 0, isl: null,
    };
    G.enterIsland(1, true);
  },
  meta() { try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch (e) { return {}; } },
  setMeta(k, v) { const m = G.meta(); m[k] = v; try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) { } },
  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } },
  save() {
    if (!G.s || G.s.phase === 'end') return;
    if (G.ISL && G.ISL.save) G.ISL.save();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.s)); } catch (e) { }
  },
  load() {
    try { G.s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { G.s = null; }
    if (!G.s) return false;
    if (G.s.phase === 'sea') G.s.phase = 'island'; // chặng biển dở dang: quay về bãi bè
    G.enterIsland(G.s.island, false);
    return true;
  },
  snapshot() { try { localStorage.setItem(SNAP_KEY, JSON.stringify(G.s)); } catch (e) { } },
  restoreSnapshot() {
    let sn = null; try { sn = JSON.parse(localStorage.getItem(SNAP_KEY)); } catch (e) { }
    if (!sn) { G.respawn(); return; }
    G.s = sn; G.enterIsland(G.s.island, false); G.save();
  },
  wipe() { try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(SNAP_KEY); } catch (e) { } },

  // ---------- Đảo ----------
  // Dựng bản đồ và vật thể từ data/islands/islandN.json
  buildIsland(n) {
    const D = ISLANDS[n - 1];
    const m = new TileMap(D);
    const ents = D.ents.map((row, i) => {
      const [p, x, y, extra] = row;
      const e = Object.assign({ id: i + 1, x, y }, U.copy(D.presets[p]), U.copy(extra || {}));
      if (e.store && !Array.isArray(e.store)) { const a = new Array(20).fill(null); let j = 0; for (const id in e.store) a[j++] = { id, n: e.store[id] }; e.store = a; }
      return e;
    });
    return { m, ents, nid: ents.length + 1 };
  },
  enterIsland(n, fresh) {
    const D = ISLANDS[n - 1];
    G.ISL = D; G.rt = {};
    const b = G.buildIsland(n);
    G.map = b.m;
    if (fresh || !G.s.isl || G.s.isl.n !== n) {
      G.s.isl = { n, ents: b.ents, nid: b.nid, q: 0, px: D.start[0] + 0.5, py: D.start[1] + 0.5 };
      G.s.island = n;
    }
    if (D.init) D.init(G.rt);
    G.repaint();
    G.mo.x = G.s.isl.px - 1; G.mo.y = G.s.isl.py - 1;
    G.s.phase = 'island';
    G.target = null; G.busyA = null;
    UI.onIsland();
    if (fresh) {
      G.snapshot(); G.save();
      UI.islandCard(D, () => {
        if (n === 1) Story.intro2();
        else Story.mo(D.mo[0]);
      });
    }
  },
  repaint() {
    G.ground = R.prerender(G.map);
    G.rt.repaint = false;
  },

  // ---------- Truy vấn ----------
  f(k) { return !!G.s.flags[k]; },
  flag(k) { G.s.flags[k] = true; },
  inc(k, n = 1) { G.s.counts[k] = (G.s.counts[k] || 0) + n; },
  tile(x, y) { const t = G.map.get(x, y); return G.ISL.tile ? G.ISL.tile(x, y, t) : t; },
  walkable(x, y) { return TILES[G.tile(x, y)].walk; },
  isWater(x, y) {
    const t = G.tile(x, y);
    if (TILES[t].swim || t === T.DEEP) return true;
    return !!(G.ISL.flooded && G.ISL.flooded(x, y));
  },
  zoneId() { const z = G.map.zoneAt(Math.floor(G.s.isl.px), Math.floor(G.s.isl.py)); return z ? z.id : null; },
  zoneName() { const z = G.map.zoneAt(Math.floor(G.s.isl.px), Math.floor(G.s.isl.py)); return z ? z.name : ''; },
  pd(e) { return U.dist(e.x, e.y, G.s.isl.px, G.s.isl.py); },
  near(pred, x, y, r) { for (const e of G.s.isl.ents) if (pred(e) && U.dist(e.x, e.y, x, y) <= r) return e; return null; },
  nearKind(k, r) { return G.near(e => e.k === k, G.s.isl.px, G.s.isl.py, r); },
  nearFire(x, y, r) { return !!G.near(e => KINDS[e.k] && KINDS[e.k].fire, x, y, r); },
  isNight() { const L = G.dayLen(), p = G.s.time % L; return p >= G.nightStart(); },
  dayLen() { return G.s.mods.longNight ? CFG.longNightDayLength : CFG.dayLength; },
  nightStart() { return CFG.nightStart; },
  day() { return Math.floor(G.s.time / G.dayLen()) + 1; },
  darkness() {
    const L = G.dayLen(), p = G.s.time % L, ns = G.nightStart();
    if (p < ns - 30) return p < 20 ? 0.6 * (1 - p / 20) : 0;
    if (p < ns) return 0.6 * (p - (ns - 30)) / 30;
    if (p > L - 20) return 0.6 * (L - p) / 20 + 0;
    return 0.6;
  },
  inShade() {
    if (G.rt.shadeT > 0) return G.rt.shadeV;
    G.rt.shadeT = 0.2;
    const I = G.s.isl, tx = Math.floor(I.px), ty = Math.floor(I.py);
    let v = !!TILES[G.tile(tx, ty)].shade;
    if (!v) for (let dy = -1; dy <= 1 && !v; dy++) for (let dx = -1; dx <= 1; dx++) if (G.tile(tx + dx, ty + dy) === T.ROCK) { v = true; break; }
    if (!v) v = !!G.near(e => { const K = KINDS[e.k]; return K && K.shadeR && !e.chopped && U.dist(e.x, e.y, I.px, I.py) <= K.shadeR; }, I.px, I.py, 3);
    G.rt.shadeV = v;
    return v;
  },
  explorePct() {
    if (!G.rt.explored) return 0;
    let n = 0;
    for (let i = 0; i < G.map.t.length; i++) if (G.rt.explored[i] && G.map.t[i] !== T.DEEP && G.map.t[i] !== T.SHALLOW) n++;
    return n / G.rt.landTotal * 100;
  },

  // ---------- Túi đồ ----------
  count(id) { let n = 0; for (let i = 0; i < G.s.invSize; i++) { const s = G.s.inv[i]; if (s && s.id === id) n += s.n; } return n; },
  has(id, n = 1) { return G.count(id) >= n; },
  hasAny(list) { return list.some(id => G.has(id)); },
  take(id, n = 1) {
    for (let i = G.s.invSize - 1; i >= 0 && n > 0; i--) {
      const s = G.s.inv[i]; if (!s || s.id !== id) continue;
      const a = Math.min(n, s.n); s.n -= a; n -= a; if (s.n <= 0) G.s.inv[i] = null;
    }
    UI.dirty = true;
  },
  giveRaw(id, n) {
    const max = STACK(id), inv = G.s.inv;
    for (let i = 0; i < G.s.invSize && n > 0; i++) { const s = inv[i]; if (s && s.id === id && s.n < max) { const a = Math.min(n, max - s.n); s.n += a; n -= a; } }
    for (let i = 0; i < G.s.invSize && n > 0; i++) if (!inv[i]) { const a = Math.min(n, max); inv[i] = { id, n: a }; n -= a; }
    UI.dirty = true;
    return n;
  },
  give(id, n = 1) {
    const left = G.giveRaw(id, n), got = n - left;
    if (got > 0) UI.floatText(got, id);
    if (left > 0) { G.dropAt(id, left, G.s.isl.px, G.s.isl.py + 0.3); G.toast('Túi đầy! ' + ITEMS[id].n + ' rơi xuống đất.'); }
    return true;
  },
  dropAt(id, n, x, y) { G.addEnt('drop', x + (Math.random() - 0.5) * 0.4, y + (Math.random() - 0.5) * 0.3, { item: id, n }); },
  dropSlot(i, all) {
    const s = G.s.inv[i]; if (!s) return;
    const n = all ? s.n : 1;
    G.dropAt(s.id, n, G.s.isl.px, G.s.isl.py + 0.4);
    s.n -= n; if (s.n <= 0) G.s.inv[i] = null;
    UI.dirty = true;
  },
  useSlot(i) {
    const s = G.s.inv[i]; if (!s) return;
    const it = ITEMS[s.id], st = G.s.st;
    if (it.type === 'food' || it.type === 'drink') {
      if (it.needTool && !G.hasAny(it.needTool)) { G.toast('Cần dao để bổ ' + it.n.toLowerCase() + '.'); return; }
      st.hunger = Math.min(100, st.hunger + (it.f || 0));
      st.thirst = Math.min(100, st.thirst + (it.w || 0));
      if (it.hp) st.hp = Math.min(100, st.hp + it.hp);
      if (it.heat) st.heat = Math.max(0, (st.heat || 0) + it.heat);
      G.take(s.id, 1);
      if (s.id === 'coconut') { G.flag('ate_coconut'); G.give('coconut_shell', 1); }
      SFX.play(it.type === 'drink' || s.id === 'coconut' ? 'drink' : 'eat');
      return;
    }
    if (s.id === 'torch' || s.id === 'lantern') {
      G.s.light = Object.assign({}, ISLAND_DATA[4].params[s.id]);
      G.take(s.id, 1); G.flag('lit_' + s.id); SFX.play('fire');
      G.toast(ITEMS[s.id].n + ' cháy sáng (' + U.fmtTime(G.s.light.t) + ')');
      return;
    }
    if (s.id === 'cooling_flask') {
      if (!G.has('water')) { G.toast('Cần 1 nước ngọt để làm mát.'); return; }
      const cool = ISLAND_DATA[3].params.flaskCool;
      G.take('water', 1); st.heat = Math.max(0, (st.heat || 0) - cool); SFX.play('drink'); G.toast('Nhiệt giảm ' + cool);
      return;
    }
    G.toast(it.d || 'Nguyên liệu để chế tạo.');
  },

  // ---------- Vật thể ----------
  addEnt(k, x, y, p) { const I = G.s.isl; const e = Object.assign({ id: I.nid++, k, x, y }, p || {}); I.ents.push(e); return e; },
  removeEnt(e) { const a = G.s.isl.ents, i = a.indexOf(e); if (i >= 0) a.splice(i, 1); if (G.target === e) G.target = null; },
  respawnLater(k, e, sec) { G.rt.respawns = G.rt.respawns || []; G.rt.respawns.push({ t: sec, k, x: e.hx ?? e.x, y: e.hy ?? e.y, p: { hx: e.hx, hy: e.hy } }); },

  // ---------- Chế tạo ----------
  recipesVisible() {
    return RECIPES.filter(r => r.isl <= G.s.island && (!r.flag || G.f(r.flag) || (r.flag === 'raft_broken' && G.s.raftBroken)) && !(r.id === 'repair' && !G.s.raftBroken)
      && !(r.raft && G.s.raft >= r.raft) && !(r.special === 'bag16' && G.s.invSize >= 16) && !(r.special === 'bag20' && G.s.invSize >= 20));
  },
  stationOK(st) {
    const I = G.s.isl;
    switch (st) {
      case 'hand': return true;
      case 'fire': return G.nearFire(I.px, I.py, 2.6);
      case 'kiln': return !!G.nearKind('kiln', 2.6);
      case 'loom': return !!G.nearKind('loom', 2.6);
      case 'camp': return !!G.near(e => KINDS[e.k] && KINDS[e.k].camp, I.px, I.py, 3.5);
      case 'raftsite': return !!G.nearKind('raftsite', 3.5);
      case 'zone:rung_duoc': return G.tile(Math.floor(I.px), Math.floor(I.py)) === T.MANGROVE;
      case 'zone:bai_bun': return G.tile(Math.floor(I.px), Math.floor(I.py)) === T.MUD;
    }
    return false;
  },
  recipeNeeds(r) {
    const ok = n => Object.keys(n).every(k => G.has(k, n[k]));
    if (ok(r.needs) || !r.alt) return r.needs;
    return ok(r.alt) ? r.alt : r.needs;
  },
  canCraft(r) {
    const needs = G.recipeNeeds(r);
    const miss = [];
    for (const k in needs) if (!G.has(k, needs[k])) miss.push(ITEMS[k].n + ' ' + G.count(k) + '/' + needs[k]);
    if (r.anyRope && G.count('coir_rope') + G.count('hemp_rope') < r.anyRope) miss.push('Dây ' + (G.count('coir_rope') + G.count('hemp_rope')) + '/' + r.anyRope);
    if (r.tools) for (const t of r.tools) if (!G.has(t)) miss.push('Cần ' + ITEMS[t].n);
    if (r.raft && G.s.raft !== r.raft - 1) miss.push('Cần bộ phận bè trước');
    if (r.raft && G.s.raftBroken) miss.push('Bè đang hỏng — sửa trước');
    const st = G.stationOK(r.st);
    return { ok: miss.length === 0 && st, miss, st, needs };
  },
  craft(r) {
    const c = G.canCraft(r);
    if (!c.ok) { G.toast(!c.st ? 'Phải ở: ' + STATION_NAME[r.st] : 'Thiếu: ' + c.miss.join(', ')); return; }
    let time = r.time || 1;
    if (r.cook && G.nearKind('stove', 3)) time /= 2;
    UI.closePanels();
    G.startBusy('Đang chế ' + r.n.toLowerCase(), time, () => {
      const c2 = G.canCraft(r); if (!c2.ok) return;
      for (const k in c2.needs) G.take(k, c2.needs[k]);
      if (r.anyRope) { let n = r.anyRope; const a = Math.min(n, G.count('coir_rope')); G.take('coir_rope', a); n -= a; G.take('hemp_rope', n); }
      if (r.out) for (const k in r.out) { G.give(k, r.out[k]); G.flag('made_' + k); }
      if (r.build) G.build(r.build);
      if (r.raft) { G.s.raft = r.raft; SFX.play('fanfare'); G.toast('Bè đã có: ' + RAFT[r.raft].part + ' · chứa ' + RAFT[r.raft].cap + ' ô'); }
      if (r.special === 'bag16') { G.s.invSize = 16; G.toast('Túi mở rộng lên 16 ô'); }
      if (r.special === 'bag20') { G.s.invSize = 20; G.toast('Túi mở rộng lên 20 ô'); }
      if (r.special === 'repair') { G.s.raftBroken = false; G.toast('Bè đã được sửa!'); }
      SFX.play('craft');
      UI.dirty = true;
    }, 'craft');
  },
  build(kind) {
    const I = G.s.isl;
    const d = { l: [-1, 0], r: [1, 0], u: [0, -1], d: [0, 1] }[G.p.dir];
    let x = I.px + d[0] * 1.1, y = I.py + d[1] * 1.1;
    if (!G.walkable(Math.floor(x), Math.floor(y)) || G.isWater(Math.floor(x), Math.floor(y))) { x = I.px; y = I.py + 0.2; }
    const props = {};
    if (kind === 'tent' || kind === 'stilt_hut') props.store = new Array(20).fill(null);
    if (kind === 'chime') props.mine = true;
    G.addEnt(kind, x, y, props);
    G.inc('built_' + kind);
    if (kind === 'campfire' && G.ISL.noise) G.ISL.noise(G.ISL.params.fireNoise);
    if (kind === 'campfire') SFX.play('fire');
  },

  // ---------- Hành động ----------
  startBusy(label, dur, fn, sfx) { G.busyA = { label, dur, t: 0, fn, sfx, tick: 0 }; },
  actNeedOK(a) {
    if (a.need && !G.hasAny(a.need)) return 'Cần ' + a.need.map(k => ITEMS[k].n).join(' hoặc ');
    if (a.needAll) { const m = a.needAll.filter(k => !G.has(k)); if (m.length) return 'Cần ' + m.map(k => ITEMS[k].n).join(' và '); }
    return null;
  },
  doAct(a) {
    if (!a || G.busyA) return;
    const why = G.actNeedOK(a);
    if (why) { G.toast(why); SFX.play('no'); return; }
    if (a.st && G.s.st.sta < a.st) { G.toast('Không đủ thể lực. Nghỉ một chút.'); SFX.play('no'); return; }
    const run = () => { if (a.st) G.s.st.sta -= a.st; if (a.noise && G.ISL.noise) G.ISL.noise(a.noise); a.f(); UI.dirty = true; };
    if (a.time && a.time > 0.3) G.startBusy(a.l, a.time, run, a.sfx); else run();
  },
  interact(i) { // i=0 chính, 1 phụ
    if (G.paused || G.s.phase !== 'island') return;
    const acts = G.target ? G.targetActs : [];
    if (!acts.length) return;
    G.doAct(acts[i] || null);
  },
  sleep(e) {
    if (!G.isNight()) {
      G.startBusy('Nghỉ ngơi', 3, () => { G.s.st.sta = 100; G.s.st.hp = Math.min(100, G.s.st.hp + 5); });
      return;
    }
    UI.fade(() => {
      const L = G.dayLen();
      G.s.time = Math.ceil(G.s.time / L) * L + 5;
      const st = G.s.st;
      st.hunger = Math.max(5, st.hunger - CFG.sleep.hunger); st.thirst = Math.max(5, st.thirst - CFG.sleep.thirst);
      st.hp = Math.min(100, st.hp + CFG.sleep.hp); st.sta = 100;
      if (G.ISL.noise) G.s.isl.sleep -= G.ISL.params.sleepNoise;
      G.toast('Ngày ' + G.day() + ' — Một đêm yên giấc.');
      G.save();
    });
  },
  dmg(n, why) {
    if (G.s.phase !== 'island') return;
    G.s.st.hp -= n; G.rt.hurtFlash = 0.4; if (n >= 5) SFX.play('hurt');
    if (G.s.st.hp <= 0) G.die(why);
  },
  die(why) {
    if (G.rt.dead) return;
    G.rt.dead = true; G.s.deaths++;
    const st = G.s.st;
    if (G.s.hard) {
      UI.dialog([{ who: '', text: U.fill(STORY.deathHard, { why }) }], () => { G.restoreSnapshot(); });
      return;
    }
    for (let i = 0; i < G.s.invSize; i++) {
      const s = G.s.inv[i]; if (!s) continue;
      const ty = ITEMS[s.id].type;
      if (ty === 'mat' || ty === 'food' || ty === 'drink') { s.n = Math.floor(s.n / 2); if (s.n <= 0) G.s.inv[i] = null; }
    }
    st.hp = CFG.death.hp; st.hunger = Math.max(st.hunger, CFG.death.minFood); st.thirst = Math.max(st.thirst, CFG.death.minFood); st.sta = 100; st.heat = 0;
    G.respawn();
    UI.dialog([{ who: '', text: U.fill(STORY.deathNormal, { why: why.toLowerCase() }) }], () => { G.rt.dead = false; });
  },
  respawn() {
    const I = G.s.isl;
    let best = null, bd = 1e9;
    for (const e of I.ents) { const K = KINDS[e.k]; if (K && (K.camp || K.sleep) && e.k !== 'buried' && !(e.k === 'lam_camp' && G.s.island === 5 && !G.f('met_lam'))) { const d = G.pd(e); if (d < bd) { bd = d; best = e; } } }
    const sp = best ? [best.x, best.y + 1] : [G.ISL.start[0] + 0.5, G.ISL.start[1] + 0.5];
    I.px = sp[0]; I.py = sp[1];
    if (!G.walkable(Math.floor(I.px), Math.floor(I.py)) || G.isWater(Math.floor(I.px), Math.floor(I.py))) { I.px = G.ISL.start[0] + 0.5; I.py = G.ISL.start[1] + 0.5; }
    G.busyA = null;
  },
  shake(t) { G.shakeT = Math.max(G.shakeT, t); },
  toast(msg, kind) { UI.toast(msg, kind); },
  pickPage(pid) {
    if (G.s.pages[pid]) return;
    G.s.pages[pid] = true; SFX.play('page');
    UI.showPage(PAGES.find(p => p.id === pid));
    const n = Object.keys(G.s.pages).length;
    if (n === 20) G.toast('Đủ 20 trang! Lá thư gửi Bống đã mở trong nhật ký.');
    G.save();
  },
  relic(id) { G.s.relics[id] = true; SFX.play('fanfare'); G.toast('Di vật: ' + RELICS[id].n); },
  sideDone(id) {
    if (G.s.side[id]) return;
    G.s.side[id] = true;
    let sd = null; for (const D of ISLANDS) for (const s of D.side) if (s.id === id) sd = s;
    if (sd) { G.toast('Nhiệm vụ phụ hoàn thành: ' + sd.t, 'good'); Cond.reward(sd.reward); }
    SFX.play('fanfare');
  },
  checkQuests() {
    const I = G.s.isl, D = G.ISL;
    while (I.q < D.main.length && Cond.ok(D.main[I.q].done)) {
      const q = D.main[I.q]; I.q++;
      G.toast('✔ Hoàn thành: ' + q.t, 'good'); SFX.play('quest');
      if (I.q >= D.main.length && D.n < 5) { setTimeout(() => { if (G.s && G.s.island === D.n) Story.mo('Bè xong! Ra khơi! Ra khơi!'); }, 1200); G.toast('Đã nhận bộ phận bè! Ra bãi đóng bè để ra khơi.', 'good'); }
      UI.dirty = true; G.save();
    }
    for (const sd of D.side) if (!G.s.side[sd.id] && sd.check && Cond.ok(sd.check)) G.sideDone(sd.id);
  },
  canSail() {
    const D = G.ISL, I = G.s.isl;
    if (D.n === 5) return I.q >= 6;
    return I.q >= D.main.length && G.s.raft >= D.n && !G.s.raftBroken;
  },
  startSail() {
    if (G.ISL.n === 5) { Story.finale(); return; }
    UI.openPack(() => {
      G.save();
      G.s.phase = 'sea';
      Sea.start(G.s.island);
    });
  },
  seaDone(ok) {
    if (ok) {
      G.s.island++;
      G.s.st.sta = 100;
      G.enterIsland(G.s.island, true);
    } else {
      G.s.raftBroken = true;
      G.s.phase = 'island';
      const rs = G.s.isl.ents.find(e => e.k === 'raftsite');
      if (rs) { G.s.isl.px = rs.x; G.s.isl.py = rs.y + 1.2; }
      UI.onIsland();
      UI.dialog([{ who: '', text: STORY.raftBroken }]);
      G.save();
    }
  },
  push(dx, dy) { G.move(dx, dy, true); },
  move(dx, dy, force) {
    const I = G.s.isl, r = 0.26;
    const ok = (nx, ny) => {
      for (const [ox, oy] of [[-r, -0.15], [r, -0.15], [-r, 0.2], [r, 0.2]]) {
        const tx = Math.floor(nx + ox), ty = Math.floor(ny + oy);
        if (!G.walkable(tx, ty)) return false;
      }
      return true;
    };
    if (ok(I.px + dx, I.py)) I.px += dx;
    if (ok(I.px, I.py + dy)) I.py += dy;
    if (force && G.ISL.onWater && G.isWater(Math.floor(I.px), Math.floor(I.py))) G.ISL.onWater();
  },

  // ---------- Cập nhật ----------
  update(dt) {
    G.time += dt;
    if (G.s.phase === 'sea') { Sea.update(dt); return; }
    if (G.s.phase !== 'island' || G.paused) return;
    const I = G.s.isl, st = G.s.st, D = G.ISL;
    G.s.time += dt;
    G.rt.shadeT = (G.rt.shadeT || 0) - dt;
    G.rt.thirstMul = 1;
    // Di chuyển
    const inp = Input.vec();
    let moving = Math.hypot(inp.x, inp.y) > 0.15;
    if (moving && G.busyA) { G.busyA = null; }
    const tx = Math.floor(I.px), ty = Math.floor(I.py);
    const onPlat = !!G.near(e => KINDS[e.k] && KINDS[e.k].platform && U.dist(e.x, e.y, I.px, I.py) < KINDS[e.k].platform, I.px, I.py, 3);
    const swim = G.isWater(tx, ty) && !onPlat;
    G.rt.swim = swim;
    const wantRun = Input.run && moving && st.sta > 3 && !swim;
    G.rt.running = wantRun;
    if (moving) {
      const MV = CFG.move;
      let sp = wantRun ? MV.run : MV.walk;
      const tt = G.tile(tx, ty);
      if (swim) sp *= MV.swimMul; else if (tt === T.MUD || tt === T.SWAMP) sp *= MV.mudMul;
      if (G.rt.panic) sp *= MV.panicMul;
      const m = Math.min(1, Math.hypot(inp.x, inp.y));
      const ang = Math.atan2(inp.y, inp.x);
      G.move(Math.cos(ang) * sp * m * dt, Math.sin(ang) * sp * m * dt);
      G.p.dir = Math.abs(inp.x) > Math.abs(inp.y) ? (inp.x < 0 ? 'l' : 'r') : (inp.y < 0 ? 'u' : 'd');
      G.p.anim += dt * (wantRun ? 1.4 : 1);
      G.rt.stepT = (G.rt.stepT || 0) - dt * (wantRun ? 1.6 : 1);
      if (G.rt.stepT <= 0) { G.rt.stepT = 0.36; SFX.play(swim ? 'swim' : 'step'); }
    }
    G.p.moving = moving;
    // Bận
    if (G.busyA) {
      const b = G.busyA; b.t += dt; b.tick -= dt;
      if (b.sfx && b.tick <= 0) { b.tick = 0.5; SFX.play(b.sfx); }
      if (b.t >= b.dur) { G.busyA = null; b.fn(); }
    }
    // Luật đảo
    if (D.update) D.update(dt);
    if (G.s.phase !== 'island') return;
    if (G.rt.repaint) G.repaint();
    // Chỉ số
    const mods = G.s.mods, RT = CFG.rates;
    st.hunger -= dt / RT.hungerEvery;
    st.thirst -= dt / RT.thirstEvery * (G.rt.thirstMul || 1) * (mods.drought ? RT.droughtMul : 1);
    if (st.hunger <= 0) { st.hunger = 0; G.rt.hT = (G.rt.hT || 0) + dt; if (G.rt.hT >= RT.starveDmgEvery) { G.rt.hT = 0; G.dmg(1, 'Đói lả'); } }
    if (st.thirst <= 0) { st.thirst = 0; G.rt.wT = (G.rt.wT || 0) + dt; if (G.rt.wT >= RT.dehydrateDmgEvery) { G.rt.wT = 0; G.dmg(1, 'Khát nước'); } }
    if (wantRun) st.sta -= RT.runDrain * dt;
    else if (swim && moving) st.sta -= RT.swimDrain * dt;
    else if (!G.rt.panic) st.sta += (G.nearFire(I.px, I.py, 3) ? RT.regenFire : moving ? RT.regenWalk : RT.regenIdle) * dt;
    st.sta = U.clamp(st.sta, 0, 100);
    if (swim && st.sta <= 0) { G.rt.sw = (G.rt.sw || 0) + dt; if (G.rt.sw > 1) { G.rt.sw = 0; G.dmg(4, 'Đuối nước'); } }
    if (st.hunger > 60 && st.thirst > 60 && st.hp < 100) st.hp = Math.min(100, st.hp + RT.wellFedRegen * dt);
    if (G.rt.hurtFlash > 0) G.rt.hurtFlash -= dt;
    // Vật thể
    for (const e of I.ents) { const K = KINDS[e.k]; if (K && K.update && (G.pd(e) < 26 || e.k === 'still' || e.k === 'chime')) K.update(e, dt); }
    if (G.rt.respawns) {
      for (const r of G.rt.respawns) { r.t -= dt; if (r.t <= 0) G.addEnt(r.k, r.x, r.y, r.p); }
      G.rt.respawns = G.rt.respawns.filter(r => r.t > 0);
    }
    // Mục tiêu tương tác
    G.findTarget();
    // Mõ
    G.updateMo(dt);
    // Nhiệm vụ
    G.rt.qT = (G.rt.qT || 0) - dt;
    if (G.rt.qT <= 0) { G.rt.qT = 0.25; G.checkQuests(); }
    G.rt.svT = (G.rt.svT || 0) + dt;
    if (G.rt.svT > CFG.autosave) { G.rt.svT = 0; G.save(); }
    if (G.shakeT > 0) G.shakeT -= dt;
  },
  findTarget() {
    const I = G.s.isl;
    const d = { l: [-1, 0], r: [1, 0], u: [0, -1], d: [0, 1] }[G.p.dir];
    const fx = I.px + d[0] * 0.45, fy = I.py + d[1] * 0.45;
    let best = null, bs = 1e9, bestActs = [];
    for (const e of I.ents) {
      const dd = U.dist(e.x, e.y, fx, fy);
      if (dd > CFG.move.reach) continue;
      const K = KINDS[e.k]; if (!K || !K.acts) continue;
      const acts = K.acts(e); if (!acts.length) continue;
      if (dd < bs) { bs = dd; best = e; bestActs = acts; }
    }
    G.target = best; G.targetActs = bestActs;
  },
  updateMo(dt) {
    const I = G.s.isl, M = G.mo;
    if (!G.s.parrot.friend) return;
    const tx = I.px + (G.p.dir === 'l' ? 0.9 : -0.9), ty = I.py - 0.9;
    M.x += (tx - M.x) * Math.min(1, dt * 2.2); M.y += (ty - M.y) * Math.min(1, dt * 2.2);
    if (M.sayT > 0) M.sayT -= dt;
    M.hintT -= dt;
    if (M.hintT <= 0) {
      M.hintT = 75 + Math.random() * 30;
      const q = G.ISL.main[I.q];
      Story.mo(q && Math.random() < 0.75 ? q.hint : G.ISL.mo[Math.floor(Math.random() * G.ISL.mo.length)]);
    }
  },

  // ---------- Vẽ ----------
  render(c, W, H, dpr) {
    if (G.s.phase === 'sea') { Sea.render(c, W, H, dpr); return; }
    const I = G.s.isl, t = G.time;
    const z = G.zoom * dpr;
    const vw = W / z, vh = H / z;
    let cx = I.px * TS - vw / 2, cy = I.py * TS - 10 - vh / 2;
    cx = U.clamp(cx, 0, G.map.w * TS - vw); cy = U.clamp(cy, 0, G.map.h * TS - vh);
    if (vw > G.map.w * TS) cx = (G.map.w * TS - vw) / 2;
    if (vh > G.map.h * TS) cy = (G.map.h * TS - vh) / 2;
    let sx = 0, sy = 0;
    if (G.shakeT > 0) { sx = (Math.random() - 0.5) * 8 * Math.min(1, G.shakeT); sy = (Math.random() - 0.5) * 8 * Math.min(1, G.shakeT); }
    G.cam.x = cx; G.cam.y = cy;
    c.setTransform(1, 0, 0, 1, 0, 0);
    R.tile(c, 'tile_deep', W, H, -cx * z, -cy * z, z);
    c.setTransform(z, 0, 0, z, (-cx + sx) * z, (-cy + sy) * z);
    const x0 = Math.max(0, Math.floor(cx / TS) - 1), y0 = Math.max(0, Math.floor(cy / TS) - 1);
    const x1 = Math.min(G.map.w, Math.ceil((cx + vw) / TS) + 1), y1 = Math.min(G.map.h, Math.ceil((cy + vh) / TS) + 1);
    const gsx = Math.max(0, cx), gsy = Math.max(0, cy), gsw = Math.min(vw, G.ground.width - gsx), gsh = Math.min(vh, G.ground.height - gsy);
    if (gsw > 0 && gsh > 0) c.drawImage(G.ground, gsx, gsy, gsw, gsh, gsx, gsy, gsw, gsh);
    // mặt nước lấp lánh
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const tt = G.map.get(x, y);
      if (tt !== T.DEEP && tt !== T.SHALLOW) continue;
      const h = U.hash2(x, y, 9);
      if (h > 0.35) continue;
      const ph = (t * 0.6 + h * 10) % 3;
      if (ph < 1.2) R.spr(c, 'sparkle', x * TS + h * 60 % 24 + 6, y * TS + 10 + ph * 4, { alpha: 1 - ph / 1.2, scale: 1 - ph / 3 });
    }
    // nước triều
    if (G.rt.tideLv > 0) {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (G.map.low[y * G.map.w + x]) R.spr(c, 'tile_flood', x * TS, y * TS, { alpha: G.rt.tideLv });
    }
    if (G.ISL.drawOver) G.ISL.drawOver(c, t);
    // Vật thể + người chơi, sắp theo y
    const list = [];
    for (const e of I.ents) if (e.x > x0 - 2 && e.x < x1 + 2 && e.y > y0 - 1 && e.y < y1 + 4) list.push(e);
    list.push({ k: '_player', x: I.px, y: I.py });
    list.sort((a, b) => (KINDS[a.k] && KINDS[a.k].flat ? -1e4 : 0) + a.y - ((KINDS[b.k] && KINDS[b.k].flat ? -1e4 : 0) + b.y));
    if (G.target) R.spr(c, 'ring', G.target.x * TS, G.target.y * TS + 2, { alpha: 0.5 + Math.sin(t * 6) * 0.3 });
    for (const e of list) {
      if (e.k === '_player') { G.drawPlayer(c, t); continue; }
      const K = KINDS[e.k]; if (K) K.draw(c, e, e.x * TS, e.y * TS, t);
    }
    if (G.s.parrot.friend) { const M = G.mo; R.spr(c, 'parrot_fly', M.x * TS, M.y * TS - 14 + Math.sin(t * 3) * 3, { t }); }
    // Ánh sáng / sương
    G.drawLight(c, W, H, z, cx - sx, cy - sy, t);
    c.setTransform(z, 0, 0, z, (-cx + sx) * z, (-cy + sy) * z);
    // phát sáng xuyên sương (đom đóm, trang nhật ký)
    if (G.ISL.fog || G.darkness() > 0.2) {
      for (const e of list) {
        const K = KINDS[e.k];
        if (K && K.glow) { const gr = K.glow(e); if (gr) R.spr(c, e.k === 'page' ? 'glow_warm' : 'glow_green', e.x * TS, e.y * TS - 10, { scale: gr * 10 / 32, alpha: 0.7 }); }
      }
    }
    // Hướng chuông gió (hỗ trợ khi không bật âm thanh)
    if (G.ISL.fog) {
      for (const e of I.ents) {
        if (e.k !== 'chime' || !(e.ring > 0)) continue;
        const d = G.pd(e); if (d > 22 || d < G.rt.vis) continue;
        const a = Math.atan2(e.y - I.py, e.x - I.px);
        R.spr(c, 'note', I.px * TS + Math.cos(a) * 60, I.py * TS - 16 + Math.sin(a) * 60, { alpha: Math.min(1, e.ring) * (1 - d / 24) });
      }
    }
    // Lớp giao diện trên thế giới (DOM): thanh bận, bong bóng lời Mõ, hiệu ứng màn hình
    const scr = (wx, wy) => [(wx * TS - cx) * G.zoom, (wy * TS - cy) * G.zoom];
    if (G.busyA) { const p = scr(I.px, I.py - 1.7); UI.busyBar(Math.min(1, G.busyA.t / G.busyA.dur), p[0], p[1]); } else UI.busyBar(null);
    if (G.mo.sayT > 0 && G.mo.say) { const p = scr(G.s.parrot.friend ? G.mo.x : I.px, (G.s.parrot.friend ? G.mo.y : I.py) - 1.5); UI.bubble(G.mo.say, p[0], p[1]); }
    else UI.bubble(null);
    UI.screenFx(G.rt.hurtFlash > 0, !!G.rt.panic, G.ISL.n === 1 && !!G.rt.sunny);
  },
  drawRaft(c, x, y, scale) {
    const o = { scale };
    R.spr(c, 'raft_' + Math.max(1, G.s.raft), x, y, o);
    for (const d of ['shells', 'stones', 'flag']) if (G.s.deco[d]) R.spr(c, 'deco_' + d, x, y, o);
  },
  playerSprite() {
    const view = G.p.dir === 'u' ? 'up' : G.p.dir === 'd' ? 'down' : 'side';
    const base = 'player_' + (G.s.gender === 'f' ? 'f' : 'm') + '_' + view;
    return { key: G.p.moving ? base : base + '_0', flip: G.p.dir === 'l' };
  },
  drawPlayer(c, t) {
    const I = G.s.isl;
    const px = I.px * TS, py = I.py * TS;
    const ps = G.playerSprite();
    const o = { t: G.p.anim, flip: ps.flip };
    if (G.rt.swim) {
      R.spr(c, 'swim_ripple', px, py - 4, { scale: 1 + Math.sin(t * 5) * 0.08 });
      c.save(); c.beginPath(); c.rect(px - 20, py - 60, 40, 52); c.clip();
      R.spr(c, ps.key, px, py + 8, o);
      c.restore(); return;
    }
    R.spr(c, ps.key, px, py, o);
    if (G.s.light && G.s.light.t > 0) {
      const im = Assets.icon[G.s.light.r > 4 ? 'lantern' : 'torch'];
      if (im) c.drawImage(im, px + (G.p.dir === 'l' ? -20 : 6), py - 28, 14, 14);
    }
  },
  drawLight(c, W, H, z, cx, cy, t) {
    const fog = G.ISL.fog, dark = G.darkness();
    if (!fog && dark < 0.02) return;
    let L = G.rt.lightCv;
    if (!L || L.width !== W || L.height !== H) { L = G.rt.lightCv = document.createElement('canvas'); L.width = W; L.height = H; }
    const l = L.getContext('2d');
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, W, H);
    if (fog) l.fillStyle = dark > 0.3 ? 'rgba(18,22,32,0.985)' : 'rgba(178,186,192,0.975)';
    else l.fillStyle = 'rgba(8,12,32,' + dark + ')';
    l.fillRect(0, 0, W, H);
    l.globalCompositeOperation = 'destination-out';
    const hole = (wx, wy, r) => {
      const sx = (wx * TS - cx) * z, sy = (wy * TS - cy) * z, rr = r * TS * z;
      if (sx < -rr || sy < -rr || sx > W + rr || sy > H + rr) return;
      const g = l.createRadialGradient(sx, sy, rr * 0.35, sx, sy, rr);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g; l.beginPath(); l.arc(sx, sy, rr, 0, 7); l.fill();
    };
    const I = G.s.isl;
    let pr = fog ? (G.rt.vis || 1.6) : 1.8;
    if (!fog && G.s.light && G.s.light.t > 0) pr = G.s.light.r;
    hole(I.px, I.py - 0.4, pr + Math.sin(t * 9) * 0.05);
    for (const e of I.ents) {
      const K = KINDS[e.k]; if (!K) continue;
      if (K.light) hole(e.x, e.y - 0.3, K.light + Math.sin(t * 11 + e.id) * 0.12);
      if (K.glow && !fog) { const gr = K.glow(e); if (gr) hole(e.x, e.y - 0.3, gr * 0.6); }
    }
    if (fog && G.f('lighthouse_lit')) hole(30, 6, 14);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(L, 0, 0);
  },
};
