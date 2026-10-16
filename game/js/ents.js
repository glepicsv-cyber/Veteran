// Người Đi Trước — hành vi các loại vật thể (hình ảnh lấy từ assets, thông số từ data)
'use strict';
const KNIFE = ['stone_knife', 'iron_knife'];
const AXE = ['stone_axe'];
const sp = (c, key, x, y, t, o) => R.spr(c, key, x, y, Object.assign({ t }, o || {}));

const KINDS = {
  // Tài nguyên: {look, item, n, extra, need, cd, once, st, time, ev, col}
  res: {
    draw(c, e, x, y, t) {
      if (e.wait > 0) return;
      const L = LOOKS[e.look];
      sp(c, e.col ? 'res_gem_' + e.col : (L ? L.sprite : 'res_stone'), x, y, t, { phase: e.id * 0.37 });
    },
    acts(e) {
      if (e.wait > 0) return [];
      const L = LOOKS[e.look];
      return [{
        l: e.label || (L ? L.label : 'Nhặt ' + ITEMS[e.item].n.toLowerCase()), time: e.time ?? 0.35, st: e.st || 0, need: e.need, noise: e.noise,
        f: () => {
          G.give(e.item, e.n || 1);
          if (e.extra) for (const k in e.extra) G.give(k, e.extra[k]);
          if (e.ev) G.inc(e.ev);
          if (e.once) G.removeEnt(e); else e.wait = e.cd || 60;
          SFX.play('pick');
        }
      }];
    },
    update(e, dt) { if (e.wait > 0) e.wait -= dt; },
    glow(e) { const L = LOOKS[e.look]; return L && L.glow && !(e.wait > 0) ? L.glow : 0; },
  },
  drop: {
    draw(c, e, x, y, t) {
      sp(c, 'item_glow', x, y, t);
      const im = Assets.icon[e.item];
      if (im) c.drawImage(im, x - 10, y - 22 + Math.sin(t * 3) * 1.5, 20, 20);
    },
    acts(e) {
      return [{ l: 'Nhặt ' + ITEMS[e.item].n.toLowerCase() + (e.n > 1 ? ' ×' + e.n : ''), time: 0.2, f: () => { const left = G.giveRaw(e.item, e.n); if (left < e.n) SFX.play('pick'); if (left <= 0) G.removeEnt(e); else { e.n = left; G.toast('Túi đầy!'); } } }];
    },
  },
  debris: {
    draw(c, e, x, y, t) { sp(c, 'item_glow', x, y, t); sp(c, 'debris_' + (e.icon || 'crate'), x, y + Math.sin(t * 2) * 1.5, t); },
    acts(e) {
      return [{
        l: 'Nhặt đồ trôi dạt', time: 0.5, f: () => {
          for (const k in e.items) G.give(k, e.items[k]);
          if (!e.noCount) G.inc('debris');
          G.removeEnt(e); SFX.play('pick');
        }
      }];
    },
  },
  palm: {
    draw(c, e, x, y, t) {
      if (e.chopped) { sp(c, 'stump', x, y, t); return; }
      sp(c, e.wait > 0 ? 'palm_bare' : 'palm_fruit', x, y, t, { phase: e.id * 0.7 });
    },
    shadeR: 1.6,
    acts(e) {
      if (e.chopped) return [];
      const a = [];
      if (!(e.wait > 0)) a.push({
        l: 'Hái dừa & lá', time: 0.8, st: 3, f: () => {
          if (Math.random() < 0.6) G.give('coconut', 1); G.give('palm_leaf', 1); G.give('husk', 2);
          e.wait = 50; SFX.play('pick');
        }
      });
      a.push({ l: 'Chặt cây', need: AXE, time: 2.2, st: 15, noise: 15, sfx: 'chop', f: () => { G.give('palm_trunk', 1); G.give('palm_leaf', 1); e.chopped = true; G.inc('palm_chop'); SFX.play('fall'); } });
      return a;
    },
    update(e, dt) { if (e.wait > 0) e.wait -= dt; },
  },
  tree: { // cây to (đảo 5, chặt gây ồn)
    draw(c, e, x, y, t) { sp(c, e.chopped ? 'stump' : 'tree_big', x, y, t); },
    shadeR: 1.5,
    acts(e) {
      if (e.chopped) return [];
      const a = [];
      if (!(e.wait > 0)) a.push({ l: 'Nhặt cành', time: 0.6, f: () => { G.give('branch', 1); e.wait = 60; SFX.play('pick'); } });
      a.push({ l: 'Chặt cây', need: AXE, time: 2.5, st: 15, noise: 20, sfx: 'chop', f: () => { G.give('firewood', 3); G.give('branch', 2); e.chopped = true; SFX.play('fall'); } });
      return a;
    },
    update(e, dt) { if (e.wait > 0) e.wait -= dt; },
  },
  burnt: { // cây cháy dở: nhựa (dao), than (rìu)
    draw(c, e, x, y, t) { sp(c, e.wait > 0 ? 'burnt' : 'burnt_resin', x, y, t); },
    acts(e) {
      const a = [];
      if (!(e.wait > 0)) a.push({ l: 'Lấy nhựa cây', need: KNIFE, time: 1.2, f: () => { G.give('resin', 1); e.wait = 70; SFX.play('pick'); } });
      if (!(e.cw > 0)) a.push({ l: 'Chặt lấy than', need: AXE, time: 2, st: 12, sfx: 'chop', f: () => { G.give('charcoal', 2); e.cw = 90; } });
      return a;
    },
    update(e, dt) { if (e.wait > 0) e.wait -= dt; if (e.cw > 0) e.cw -= dt; },
  },
  pine: {
    draw(c, e, x, y, t) { sp(c, e.wait > 0 ? 'pine' : 'pine_resin', x, y, t); },
    shadeR: 1.2,
    acts(e) {
      const a = [];
      if (!(e.wait > 0)) a.push({ l: 'Lấy nhựa thông', time: 1, f: () => { G.give('pine_resin', 1); e.wait = 60; SFX.play('pick'); } });
      if (!(e.cw > 0)) a.push({ l: 'Bẻ cành', time: 0.7, f: () => { G.give('branch', 1); e.cw = 50; SFX.play('pick'); } });
      return a;
    },
    update(e, dt) { if (e.wait > 0) e.wait -= dt; if (e.cw > 0) e.cw -= dt; },
  },
  crab: {
    draw(c, e, x, y, t) { sp(c, 'crab', x, y, t, { phase: e.id }); },
    acts(e) {
      return [{
        l: 'Bắt cua', time: 0.5, st: 4, f: () => {
          if (Math.random() < 0.7) { G.give('crab', 1); G.inc('crab'); G.removeEnt(e); SFX.play('pick'); G.respawnLater('crab', e, 40); }
          else { G.toast('Cua chạy mất!'); e.vx = (Math.random() - 0.5) * 6; e.vy = (Math.random() - 0.5) * 6; e.t = 0.6; }
        }
      }];
    },
    update(e, dt) {
      if (e.hx == null) { e.hx = e.x; e.hy = e.y; }
      e.t = (e.t || 0) - dt;
      if (e.t <= 0) { e.vx = (Math.random() - 0.5) * 1.6; e.vy = (Math.random() - 0.5) * 0.6; e.t = 1 + Math.random() * 2; }
      const nx = e.x + e.vx * dt, ny = e.y + e.vy * dt;
      const tt = G.map.get(Math.floor(nx), Math.floor(ny));
      if ((tt === T.TIDEPOOL || tt === T.SAND || tt === T.STONE) && Math.hypot(nx - e.hx, ny - e.hy) < 4) { e.x = nx; e.y = ny; } else { e.vx *= -1; e.vy *= -1; }
    },
  },
  page: {
    draw(c, e, x, y, t) { sp(c, 'item_glow', x, y, t); sp(c, 'page', x, y + Math.sin(t * 2.5) * 2, t); },
    acts(e) { return [{ l: 'Nhặt trang nhật ký', time: 0.4, f: () => { G.removeEnt(e); G.pickPage(e.pid); } }]; },
    glow() { return 1.5; },
  },
  parrot_wild: {
    draw(c, e, x, y, t) { sp(c, 'parrot_perch', x, y, t); },
    acts(e) {
      return [{
        l: 'Cho vẹt ăn dừa', need: ['coconut'], time: 0.8, f: () => {
          G.take('coconut', 1); G.s.parrot.fed++;
          SFX.play('parrot');
          if (G.s.parrot.fed >= 3) {
            G.s.parrot.friend = true; G.removeEnt(e);
            UI.dialog(storyLines('parrotJoin'), () => G.pickPage('p1_3'));
            G.sideDone('parrot');
          } else G.toast('Mõ ăn ngon lành (' + G.s.parrot.fed + '/3)');
        }
      }];
    },
  },
  // --- Trại & công trình ---
  lam_camp: {
    draw(c, e, x, y, t) { sp(c, 'lam_camp', x, y, t); },
    shadeR: 2, camp: true,
    acts(e) { return [{ l: 'Mở rương của Lâm', f: () => UI.openStore(e) }]; },
  },
  tent: {
    draw(c, e, x, y, t) { sp(c, 'tent', x, y, t); },
    shadeR: 2.2, camp: true, sleep: true,
    acts(e) { return [{ l: G.isNight() ? 'Ngủ qua đêm' : 'Nghỉ trong lều', f: () => G.sleep(e) }, { l: 'Mở rương', f: () => UI.openStore(e) }]; },
  },
  stilt_hut: {
    draw(c, e, x, y, t) { sp(c, 'stilt_hut', x, y, t); },
    shadeR: 2.2, camp: true, sleep: true, platform: 1.6,
    acts(e) { return [{ l: G.isNight() ? 'Ngủ qua đêm' : 'Nghỉ trên chòi', f: () => G.sleep(e) }, { l: 'Mở rương', f: () => UI.openStore(e) }]; },
  },
  campfire: {
    draw(c, e, x, y, t) { sp(c, 'campfire', x, y, t, { phase: e.id }); },
    light: 4.5, camp: true, fire: true,
    acts(e) { return [{ l: 'Ngồi bên lửa', time: 3, f: () => { G.s.st.sta = 100; G.toast('Thể lực hồi phục'); } }]; },
  },
  still: {
    draw(c, e, x, y, t) { sp(c, 'still', x, y, t); for (let i = 0; i < (e.water || 0); i++) sp(c, 'water_drop', x - 8 + i * 8, y - 22, t); },
    acts(e) {
      if ((e.water || 0) > 0) return [{ l: 'Lấy nước ngọt (' + e.water + ')', f: () => { const n = e.water; const left = G.giveRaw('water', n); e.water = left; if (left < n) { G.flag('still_water'); SFX.play('water'); } else G.toast('Túi đầy!'); } }];
      return [{ l: G.nearFire(e.x, e.y, 3) ? 'Đang chưng cất…' : 'Cần đống lửa bên cạnh', f: () => { } }];
    },
    update(e, dt) {
      if (!G.nearFire(e.x, e.y, 3)) return;
      e.t = (e.t || 0) + dt;
      if (e.t > CFG.stillEvery && (e.water || 0) < CFG.stillMax) { e.t = 0; e.water = (e.water || 0) + 1; }
    },
  },
  raftsite: {
    draw(c, e, x, y, t) {
      sp(c, 'raftsite', x, y, t);
      if (G.s.raft > 0) G.drawRaft(c, x, y + Math.sin(t * 2), 1);
      if (G.s.raftBroken) sp(c, 'broken', x, y, t);
    },
    acts(e) {
      const a = [];
      if (G.canSail()) a.push({ l: G.s.island === 5 ? 'Về đất liền' : 'Ra khơi', f: () => G.startSail() });
      a.push({ l: 'Bãi đóng bè — mở chế tạo', f: () => UI.openCraft() });
      return a;
    },
  },
  peak: {
    draw(c, e, x, y, t) { if (!G.f('peak1')) sp(c, 'peak_flag', x, y, t); },
    acts() { return []; },
    update(e) {
      if (!G.f('peak1') && G.pd(e) < 1.5) { G.flag('peak1'); G.sideDone('peak'); UI.dialog(storyLines('peak')); }
    },
  },
  // --- Đảo 2 ---
  tide_gauge: { draw(c, e, x, y, t) { sp(c, 'tide_gauge', x, y, t); }, acts() { return []; } },
  stakes: { draw(c, e, x, y, t) { sp(c, 'stakes', x, y, t); }, acts() { return []; } },
  fish_trap: {
    draw(c, e, x, y, t) { sp(c, 'fish_trap', x, y, t); for (let i = 0; i < (e.fish || 0); i++) sp(c, 'res_fish', x - 8 + i * 6, y - 2, t, { phase: i, scale: 0.7 }); },
    acts(e) { return (e.fish || 0) > 0 ? [{ l: 'Lấy cá (' + e.fish + ')', f: () => { const left = G.giveRaw('fish', e.fish); e.fish = left; SFX.play('pick'); } }] : [{ l: 'Bẫy trống — chờ nước rút', f: () => { } }]; },
  },
  wreck: {
    draw(c, e, x, y, t) { sp(c, 'wreck', x, y, t); },
    acts(e) {
      const n = e.searched || 0;
      if (n >= 3) return [];
      return [{
        l: 'Lục xác tàu (' + n + '/3)', time: 2.5, st: 10, f: () => {
          e.searched = n + 1;
          if (n === 0) { G.give('plank', 3); G.give('nail', 4); }
          if (n === 1) { G.give('plank', 2); G.give('lens', 1); G.toast('Thấu kính đèn! Đảo sau có thể cần.'); }
          if (n === 2) { G.give('plank', 1); G.give('glass_jar', 1); G.flag('wreck_done'); }
          SFX.play('pick');
        }
      }];
    },
  },
  cave_chest: {
    draw(c, e, x, y, t) { sp(c, e.open ? 'cave_chest_open' : 'cave_chest', x, y, t); },
    acts(e) {
      if (e.open) return [];
      return [{ l: 'Mở hòm của Lâm', time: 1, f: () => { e.open = true; G.give('sisal', 3); G.give('hemp_rope', 1); G.flag('cave_chest'); G.pickPage('p2_4'); } }];
    },
  },
  baby_turtle: {
    draw(c, e, x, y, t) { sp(c, G.f('baby_turtle') ? 'crevice' : 'baby_turtle', x, y, t); },
    acts(e) { return G.f('baby_turtle') ? [] : [{ l: 'Gỡ rùa con khỏi khe đá', time: 2.5, st: 10, f: () => { G.flag('baby_turtle'); G.sideDone('turtle'); SFX.play('parrot'); UI.dialog(storyLines('babyTurtle')); } }]; },
  },
  // --- Đảo 3 ---
  spring_well: {
    draw(c, e, x, y, t) { sp(c, 'spring_well', x, y, t); },
    acts(e) { return [{ l: 'Lấy nước mạch ngầm', time: 0.8, f: () => { G.give('water', 1); G.flag('found_spring'); SFX.play('water'); } }]; },
  },
  kiln: {
    draw(c, e, x, y, t) { sp(c, 'kiln', x, y, t); },
    light: 2, camp: true,
    acts() { return [{ l: 'Lò nung — mở chế tạo', f: () => UI.openCraft() }]; },
  },
  stove: {
    draw(c, e, x, y, t) { sp(c, 'stove', x, y, t); },
    light: 1.5, fire: true, camp: true,
    acts() { return [{ l: 'Bếp đá — mở chế tạo', f: () => UI.openCraft() }]; },
  },
  buried: {
    draw(c, e, x, y, t) { sp(c, 'buried_' + Math.min(3, e.dug || 0), x, y, t); },
    camp: true,
    acts(e) {
      if ((e.dug || 0) >= 3) return [{ l: 'Mở rương trại', f: () => UI.openStore(e) }];
      return [{
        l: 'Đào trại bị vùi (' + (e.dug || 0) + '/3)', time: 2.5, st: 20, sfx: 'dig', f: () => {
          e.dug = (e.dug || 0) + 1;
          if (e.dug >= 3) { G.flag('dug_camp'); G.give('ore', 2); G.give('charcoal', 2); G.relic('iron_fish'); G.pickPage('p3_3'); }
        }
      }];
    },
  },
  // --- Đảo 4 ---
  chime: {
    draw(c, e, x, y, t) { sp(c, 'chime', x, y, t, { phase: e.id }); },
    acts() { return []; },
    update(e, dt) {
      e.t = (e.t || Math.random() * 3) - dt;
      if (e.t <= 0) { e.t = 3.2; const d = G.pd(e); if (d < 22) { SFX.chime(e.x - G.s.isl.px, d, e.mine); e.ring = 1; } }
      if (e.ring > 0) e.ring -= dt;
    },
  },
  lighthouse: {
    draw(c, e, x, y, t) { sp(c, G.f('lighthouse_lit') ? 'lighthouse_lit' : 'lighthouse', x, y, t); },
    acts() {
      if (G.f('lighthouse_lit')) return [];
      return [{
        l: 'Thắp hải đăng', needAll: ['lens', 'lamp_oil'], time: 3, f: () => {
          G.take('lens', 1); G.take('lamp_oil', 1); G.flag('lighthouse_lit'); SFX.play('fanfare');
          UI.dialog(storyLines('lighthouse'));
        }
      }];
    },
  },
  door: {
    draw(c, e, x, y, t) { sp(c, !e.pushed ? 'door_blocked' : !e.taken ? 'door_needle' : 'door_open', x, y, t); },
    acts(e) {
      if (!e.pushed) return [{ l: 'Đẩy tảng đá', time: 3, st: 30, f: () => { e.pushed = true; SFX.play('fall'); G.toast('Tảng đá lăn ra. Cánh cửa sắt gỉ lộ ra.'); } }];
      if (!e.taken) return [{ l: 'Gỡ kim từ cửa sắt', time: 1.5, f: () => { e.taken = true; G.give('iron_needle', 1); } }];
      return [];
    },
  },
  carving: {
    draw(c, e, x, y, t) { sp(c, e.seen ? 'carving_seen' : 'carving', x, y, t); },
    acts(e) {
      return [{
        l: 'Xem bức khắc', f: () => {
          if (!e.seen) { e.seen = true; G.inc('carving'); }
          UI.dialog([{ who: '', text: e.text }]);
          if ((G.s.counts.carving || 0) >= 3 && !G.f('carvings')) { G.flag('carvings'); G.sideDone('carvings'); }
        }
      }];
    },
  },
  loom: {
    draw(c, e, x, y, t) { sp(c, 'loom', x, y, t); },
    acts() { return [{ l: 'Khung dệt — mở chế tạo', f: () => UI.openCraft() }]; },
  },
  // --- Đảo 5 ---
  lam: {
    draw(c, e, x, y, t) { sp(c, 'lam', x, y, t); },
    acts(e) { return [{ l: 'Nói chuyện với Lâm', f: () => Story.talkLam() }]; },
  },
  leg: {
    draw(c, e, x, y, t) { sp(c, !G.f('net_cut') ? 'leg_full' : !G.f('hooks_cut') ? 'leg_hooks' : 'leg_free', x, y, t); },
    acts(e) {
      const a = [];
      if (!G.f('net_cut')) a.push({ l: 'Gỡ lưới quấn chân rùa', need: KNIFE, time: 4, st: 20, f: () => { G.flag('net_cut'); SFX.play('pick'); G.toast('Đã gỡ hết lưới.'); if (!G.has('iron_knife')) Story.mo('Lưỡi câu sắt! Dao đá không cắt nổi!'); } });
      else if (!G.f('hooks_cut')) a.push({ l: G.has('iron_knife') ? 'Cắt lưỡi câu sắt' : 'Lưỡi câu sắt (cần dao sắt)', need: ['iron_knife'], time: 4, st: 20, f: () => { G.flag('hooks_cut'); SFX.play('fanfare'); UI.dialog(storyLines('hooksCut')); } });
      return a;
    },
  },
  turtle_head: {
    draw(c, e, x, y, t) { sp(c, 'turtle_head', x, y, t); },
    acts() { return [{ l: 'Nhìn mắt rùa', f: () => UI.dialog(storyLines('turtleEye')) }]; },
  },
  footprints: { draw(c, e, x, y, t) { sp(c, 'footprints', x, y, t); }, acts() { return []; }, flat: true },
  sign: {
    draw(c, e, x, y, t) { sp(c, 'sign', x, y, t); },
    acts(e) { return [{ l: 'Xem', f: () => UI.dialog([{ who: '', text: e.text }]) }]; },
  },
};
