// Người Đi Trước — luật riêng của từng đảo. Thông số lấy từ "params" trong data/islands/islandN.json
'use strict';
const has = id => G.has(id), f = k => G.f(k);
const P = () => G.ISL.params;

const RULES = {
  // ---------- Đảo 1: Nắng gắt ----------
  1: {
    update(dt) {
      G.rt.thirstMul = (!G.isNight() && !G.inShade()) ? P().sunMul : 1;
      G.rt.sunny = G.rt.thirstMul > 1;
    },
    hud() { return G.rt.sunny ? '☀️ Nắng gắt: Khát x' + P().sunMul : '🌴 Bóng râm'; },
  },

  // ---------- Đảo 2: Thủy triều ----------
  2: {
    init() { G.s.isl.tide = G.s.isl.tide ?? P().first; },
    phase() { const p = P(), t = G.s.isl.tide % p.cycle; return { t, riseAt: p.cycle - p.high - p.ramp, p }; },
    update(dt) {
      const I = G.s.isl, prevHigh = G.rt.tideHigh;
      I.tide += dt;
      const { t, riseAt, p } = RULES[2].phase();
      let lv = 0;
      if (t >= riseAt && t < riseAt + p.ramp) lv = (t - riseAt) / p.ramp;
      else if (t >= riseAt + p.ramp && t < p.cycle - p.ramp) lv = 1;
      else if (t >= p.cycle - p.ramp) lv = 1 - (t - (p.cycle - p.ramp)) / p.ramp;
      G.rt.tideLv = lv;
      G.rt.tideHigh = lv > 0.5;
      if (t >= riseAt - p.warn && t < riseAt - p.warn + 1 && !G.rt.warned) { G.rt.warned = true; Story.mo('Nước sắp lên! Lên chỗ cao!'); }
      if (t < riseAt - p.warn - 1) G.rt.warned = false;
      if (G.rt.tideHigh && prevHigh === false) Tide.rise();
      if (!G.rt.tideHigh && prevHigh) Tide.fall();
    },
    flooded(x, y) { return G.rt.tideHigh && G.map.low[y * G.map.w + x]; },
    hud() {
      const { t, riseAt, p } = RULES[2].phase();
      const exact = (G.s.counts.built_tide_gauge || 0) > 0;
      if (G.rt.tideHigh || t >= riseAt) { const r = p.cycle - t; return '🌊 Triều cao · rút sau ' + (exact ? U.fmtTime(r) : '~' + Math.ceil(r / 30) * 30 + 's'); }
      const r = riseAt - t;
      return '🏖️ Triều thấp · lên sau ' + (exact ? U.fmtTime(r) : (r > 60 ? '~' + Math.round(r / 60) + ' phút' : 'chưa tới 1 phút'));
    },
  },

  // ---------- Đảo 3: Đất nóng & phun trào ----------
  3: {
    init() {
      const I = G.s.isl;
      if (I.erupt == null) { I.erupt = P().eruptFirst; I.aHot = true; I.bHot = false; I.nErupt = 0; }
      G.rt.lavaTiles = [];
      for (let y = 0; y < G.map.h; y++) for (let x = 0; x < G.map.w; x++) { const tg = G.map.tag[y * G.map.w + x]; if (tg) G.rt.lavaTiles.push([x, y, tg]); }
      G.rt.rocks = [];
    },
    tile(x, y, t) {
      if (t === T.BASALT) { const tg = G.map.tag[y * G.map.w + x]; if ((tg === 1 && G.s.isl.aHot) || (tg === 2 && G.s.isl.bHot)) return T.LAVA; }
      return t;
    },
    update(dt) {
      const I = G.s.isl, st = G.s.st, p = P();
      I.erupt -= dt;
      if (I.erupt <= 0 && !G.rt.erupting) { G.rt.erupting = p.eruptDur; Story.mo('Núi phun! Núi phun!'); SFX.play('rumble'); G.shake(1.2); }
      if (G.rt.erupting) {
        G.rt.erupting -= dt;
        G.shake(0.3);
        G.rt.rockT = (G.rt.rockT || 0) - dt;
        if (G.rt.rockT <= 0) {
          G.rt.rockT = p.rockEvery;
          G.rt.aim = (G.rt.aim || 0) + 1;
          const a = Math.random() * 7, r = G.rt.aim % 4 === 0 ? 0 : 1.5 + Math.sqrt(Math.random()) * 5;
          G.rt.rocks.push({ x: I.px + Math.cos(a) * r, y: I.py + Math.sin(a) * r, t: p.rockWarn });
        }
        if (G.rt.erupting <= 0) {
          G.rt.erupting = 0; I.erupt = p.eruptEvery; I.nErupt++;
          if (I.aHot) { I.aHot = false; I.bHot = true; G.toast('Dòng dung nham phía đông đã nguội thành đường đi!'); Story.mo('Đường mới! Sang đông!'); }
          else I.bHot = !I.bHot;
        }
      }
      for (const rk of G.rt.rocks) {
        rk.t -= dt;
        if (rk.t <= 0 && !rk.hit) { rk.hit = true; SFX.play('thud'); if (U.dist(rk.x, rk.y, I.px, I.py) < 0.8) G.dmg(p.rockDmg, 'Đá rơi trúng người'); }
      }
      G.rt.rocks = G.rt.rocks.filter(r => r.t > -0.4);
      // Nhiệt
      const tx = Math.floor(I.px), ty = Math.floor(I.py), tt = G.tile(tx, ty);
      let dh = -p.cool;
      if (tt === T.HOT) dh = has('bark_sandals') ? p.heatHotSandals : p.heatHot;
      if (tt === T.SPRING) { dh = p.heatSpring; st.hp = Math.min(100, st.hp + p.springHeal * dt); }
      if (G.inShade() || TILES[tt].swim) dh = Math.min(dh, -p.coolShade);
      let nearLava = false;
      for (let dy = -2; dy <= 2 && !nearLava; dy++) for (let dx = -2; dx <= 2; dx++) if (G.tile(tx + dx, ty + dy) === T.LAVA) { nearLava = true; break; }
      if (nearLava) dh = Math.max(dh, 0) + p.heatLava;
      st.heat = U.clamp((st.heat || 0) + dh * dt, 0, 110);
      if (st.heat >= 100) { G.rt.hurtHeat = (G.rt.hurtHeat || 0) + dt; if (G.rt.hurtHeat > 0.5) { G.rt.hurtHeat = 0; G.dmg(1, 'Quá nóng'); } }
      if (!f('reached_east') && G.zoneId() === 'suon_dong' && !I.aHot) G.flag('reached_east');
    },
    drawOver(c, t) {
      for (const [x, y] of G.rt.lavaTiles) if (G.tile(x, y) === T.LAVA) R.spr(c, 'tile_lava', x * TS, y * TS, { t, phase: (x + y) % 3 });
      for (const rk of G.rt.rocks) {
        const px = rk.x * TS, py = rk.y * TS;
        if (rk.t > 0) {
          R.spr(c, 'warn', px, py, { alpha: 0.5 + (P().rockWarn - rk.t) * 0.3 });
          R.spr(c, 'falling_rock', px, py - rk.t * 260);
        } else R.spr(c, 'rock_landed', px, py);
      }
    },
    hud() {
      if (G.rt.erupting) return '🌋 NÚI ĐANG PHUN!';
      return '🌋 Núi phun sau ' + U.fmtTime(G.s.isl.erupt) + ' · 🌡️ ' + Math.round(G.s.st.heat || 0);
    },
  },

  // ---------- Đảo 4: Sương mù ----------
  4: {
    init() {
      const I = G.s.isl;
      if (!I.explored) I.explored = '';
      G.rt.explored = new Uint8Array(G.map.w * G.map.h);
      for (let i = 0; i < I.explored.length; i++) if (I.explored[i] === '1') G.rt.explored[i] = 1;
      G.rt.landTotal = 0;
      for (let i = 0; i < G.map.t.length; i++) if (G.map.t[i] !== T.DEEP && G.map.t[i] !== T.SHALLOW) G.rt.landTotal++;
      I.dark = I.dark || 0;
    },
    nearLighthouse() { const L = P().lighthouse; return f('lighthouse_lit') && U.dist(G.s.isl.px, G.s.isl.py, L.x, L.y) < L.r; },
    update(dt) {
      const I = G.s.isl, L = G.s.light, p = P();
      let r = p.darkVis;
      if (L && L.t > 0) { L.t -= dt; r = L.r; if (L.t <= 0) { G.s.light = null; G.toast('Ánh sáng đã tắt!'); Story.mo('Tối! Tối quá!'); } }
      const nearF = G.nearFire(I.px, I.py, 4);
      if (nearF) r = Math.max(r, p.fireVis);
      const lh = RULES[4].nearLighthouse();
      if (lh) r = Math.max(r, p.lighthouse.vis);
      if (G.isNight()) r *= p.nightMul;
      G.rt.vis = r;
      const lit = (L && L.t > 0) || nearF || lh;
      I.dark = lit ? 0 : I.dark + dt;
      G.rt.panic = I.dark > p.panicAfter;
      if (G.rt.panic) { G.s.st.sta = Math.max(0, G.s.st.sta - p.panicDrain * dt); if (Math.random() < dt * 0.3) Story.mo('Hoảng quá! Cần ánh sáng!'); }
      G.rt.expT = (G.rt.expT || 0) - dt;
      if (G.rt.expT <= 0) {
        G.rt.expT = 0.25;
        const R0 = Math.max(2.5, r);
        for (let y = Math.floor(I.py - R0); y <= I.py + R0; y++) for (let x = Math.floor(I.px - R0); x <= I.px + R0; x++)
          if (G.map.inb(x, y) && U.dist(x + 0.5, y + 0.5, I.px, I.py) <= R0) G.rt.explored[y * G.map.w + x] = 1;
      }
      if (!f('found_camp4') && G.zoneId() === 'trai_lam') { G.flag('found_camp4'); SFX.play('fanfare'); G.toast('Tìm thấy trại của Lâm!'); }
    },
    save() { let s = ''; for (let i = 0; i < G.rt.explored.length; i++) s += G.rt.explored[i] ? '1' : '0'; G.s.isl.explored = s; },
    hud() {
      const L = G.s.light;
      let s = L && L.t > 0 ? (L.r > 4 ? '🏮 ' : '🔦 ') + U.fmtTime(L.t) : '🌫️ Không có ánh sáng';
      if (G.rt.panic) s += ' · 😨 Hoảng loạn';
      else if (G.s.isl.dark > 5) s += ' · tối ' + Math.floor(G.s.isl.dark) + 's/' + P().panicAfter + 's';
      return s;
    },
  },

  // ---------- Đảo 5: Đất biết thở ----------
  5: {
    init() { const I = G.s.isl; if (I.sleep == null) { I.sleep = P().sleep; I.breath = P().breathEvery; } },
    update(dt) {
      const I = G.s.isl, p = P();
      I.sleep -= dt;
      if (G.rt.running) I.sleep -= dt * (has('straw_sandals') ? p.runNoiseSandals : p.runNoise);
      if (I.sleep <= 0) { Story.turtleDives(); return; }
      I.breath -= dt;
      if (I.breath <= p.breathWarn && I.breath > 0 && !G.rt.breathWarn) { G.rt.breathWarn = true; Story.mo('Đất thở! Bám chặt!'); SFX.play('breath'); }
      if (I.breath <= 0 && !G.rt.tilt) {
        const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];
        G.rt.tilt = { t: p.tilt, dx: d[0], dy: d[1], fell: false };
        G.shake(0.6);
      }
      if (G.rt.tilt) {
        const tl = G.rt.tilt;
        tl.t -= dt;
        G.shake(0.15);
        const tt = G.tile(Math.floor(I.px), Math.floor(I.py));
        const grip = (tt === T.FOREST || tt === T.GARDEN || tt === T.CAVE) ? p.grip : 1;
        G.push(tl.dx * p.push * grip * dt, tl.dy * p.push * grip * dt);
        for (const e of I.ents) if (e.k === 'drop') { e.x += tl.dx * 1.5 * dt; e.y += tl.dy * 1.5 * dt; }
        if (tl.t <= 0) {
          G.rt.tilt = null; G.rt.breathWarn = false; I.breath = p.breathEvery;
          if (!tl.fell && !f('breath_ok')) { G.flag('breath_ok'); G.toast('Bạn đã trụ vững qua nhịp thở!'); }
        }
      }
      if (!f('found_garden') && G.zoneId() === 'vuon_rau') { G.flag('found_garden'); Story.mo('Có người trồng! Dấu chân!'); }
      if (!f('met_lam') && U.dist(I.px, I.py, p.lam.x, p.lam.y) < p.lam.r) Story.meetLam();
    },
    onWater() {
      if (G.rt.tilt && !G.rt.tilt.fell) { G.rt.tilt.fell = true; G.dmg(P().fallDmg, 'Rơi khỏi mép mai'); G.respawn(); G.toast('Bạn rơi khỏi mép mai!'); }
    },
    hud() { const I = G.s.isl; return '🐢 Rùa ngủ: ' + U.fmtTime(I.sleep) + (G.rt.tilt ? ' · ĐẤT ĐANG NGHIÊNG!' : ' · thở sau ' + U.fmtTime(I.breath)); },
    noise(n) { G.s.isl.sleep -= n; G.toast('Tiếng ồn! Rùa ngủ ít đi ' + n + 's', 'warn'); },
  },
};

// Thủy triều (đảo 2)
const Tide = {
  rise() {
    const I = G.s.isl, m = G.map;
    I.ents = I.ents.filter(e => !e.temp);
    for (const e of I.ents) {
      if (e.k === 'drop' && m.low[Math.floor(e.y) * m.w + Math.floor(e.x)]) {
        const z = m.zoneById('con_cao'); e.x = z.cx + (Math.random() - 0.5) * 8; e.y = z.cy + (Math.random() - 0.5) * 6;
        G.toast('Nước cuốn trôi ' + ITEMS[e.item].n.toLowerCase() + ' sang chỗ khác!');
      }
    }
    SFX.play('wave');
    Story.mo('Nước lên! Nước lên!');
  },
  fall() {
    const I = G.s.isl, m = G.map, p = P();
    if (!G.f('tide1')) G.flag('tide1');
    const rng = U.rng(Math.floor(I.tide));
    const spots = [];
    for (let i = 0; i < 600 && spots.length < 12; i++) {
      const x = rng.int(4, m.w - 4), y = rng.int(4, m.h - 4);
      if (m.get(x, y) === T.MUD) spots.push([x + 0.5, y + 0.5]);
    }
    const kinds = [['fish', 'fish'], ['shellfish', 'shellfish'], ['shellfish', 'shellfish'], ['seaweed', 'seaweed']];
    spots.forEach((s, i) => {
      if (i < 10) { const k = kinds[i % 4]; G.addEnt('res', s[0], s[1], { look: k[0], item: k[1], once: true, temp: true }); }
      else G.addEnt('debris', s[0], s[1], { items: rng() < 0.5 ? { drybranch: 1, firewood: 1 } : { plank: 1 }, icon: 'crate', temp: true, noCount: true });
    });
    for (const e of I.ents) if (e.k === 'fish_trap') e.fish = Math.min(p.trapMax, (e.fish || 0) + p.trapFish);
    G.toast('Nước rút — bãi bùn để lại cá, sò và đồ trôi dạt.');
  },
};

// Ghép dữ liệu đảo (JSON) với luật (code)
const ISLANDS = [];
function buildIslands() {
  for (let n = 1; n <= 5; n++) ISLANDS[n - 1] = Object.assign({}, ISLAND_DATA[n], RULES[n]);
}
