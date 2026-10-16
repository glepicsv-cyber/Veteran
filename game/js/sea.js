// Người Đi Trước — chặng biển: lái bè né chướng ngại, quăng móc vớt đồ (thông số: data/sea.json)
'use strict';
const Sea = {
  S: null,
  start(leg) {
    const R0 = RAFT[G.s.raft], L = SEA.legs[leg];
    Sea.S = {
      leg, x: 0, vx: 0, t: 0, dur: SEA.baseDuration / R0.speed, hp: 100, objs: [], hook: 0, spawnT: 1.5,
      scroll: 0, storm: !!L.storm || !!G.s.mods.storms, stormHit: false, compass: G.s.raft >= 4, waveT: 6, msgT: 0,
    };
    UI.onSea();
    UI.dialog([{ who: 'Chặng biển', text: L.name + '. ' + L.tip }]);
    SFX.play('wave');
  },
  spawn() {
    const S = Sea.S, pool = SEA.legs[S.leg].events;
    const type = pool[Math.floor(Math.random() * pool.length)];
    const o = { type, x: (Math.random() * 2 - 1) * 0.9, y: -0.08 };
    if (type === 'shark') { o.x = Math.random() < 0.5 ? -1.1 : 1.1; o.y = 0.15 + Math.random() * 0.25; }
    S.objs.push(o);
  },
  update(dt) {
    const S = Sea.S;
    if (!S || G.paused) return;
    S.t += dt; S.scroll += dt;
    const ST = SEA.storm;
    if (S.storm && !S.stormHit && S.t > 3) {
      S.stormHit = true;
      if (G.s.raft < 3) { S.hp -= ST.dmgBelowLevel3; Sea.msg('Bão đánh tới! Bè chưa đủ chắc: -' + ST.dmgBelowLevel3 + ' độ bền'); SFX.play('crash'); G.shake(1); }
      else Sea.msg('Bão đánh tới! Bè chống thấm trụ vững.');
    }
    if (S.storm) {
      S.waveT -= dt;
      if (S.waveT <= 0) { S.waveT = ST.waveMin + Math.random() * (ST.waveMax - ST.waveMin); S.vx += (Math.random() < 0.5 ? -1 : 1) * ST.waveForce; G.shake(0.4); SFX.play('wave'); }
    }
    const inp = Input.vec();
    S.vx += inp.x * 7 * dt;
    S.vx *= Math.pow(0.04, dt);
    S.x = U.clamp(S.x + S.vx * dt, -0.95, 0.95);
    if (Math.abs(S.x) >= 0.95) S.vx = 0;
    S.hook = Input.hold ? Math.min(0.45, S.hook + dt * 1.2) : Math.max(0, S.hook - dt * 2);
    S.spawnT -= dt;
    if (S.spawnT <= 0 && S.t < S.dur - 4) { S.spawnT = (S.storm ? 0.75 : 0.95) + Math.random() * 0.7; Sea.spawn(); }
    const spd = SEA.scrollSpeed * RAFT[G.s.raft].speed, RY = SEA.raftY;
    for (const o of S.objs) {
      const D = SEA.objects[o.type];
      if (o.type === 'shark') { o.x += Math.sign(S.x - o.x) * 0.35 * dt; o.y += spd * 0.6 * dt; }
      else o.y += spd * dt;
      if (o.type === 'fish' && o.y > RY - 0.12 && !o.jump) { o.jump = true; if (Math.abs(o.x - S.x) < 0.3) { o.dead = true; G.giveRaw('fish', 1); Sea.msg('Cá chuồn nhảy lên bè! +1 cá'); SFX.play('splash'); } }
      if (o.dead) continue;
      if (D.hit && Math.abs(o.y - RY) < 0.045 && Math.abs(o.x - S.x) < D.hit + 0.08) {
        if (o.type === 'crate') { Sea.loot(o); continue; }
        S.hp -= D.dmg; o.dead = true; G.shake(0.6); SFX.play('crash');
        Sea.msg(D.msg + ': -' + D.dmg + ' độ bền');
      }
      if (o.type === 'crate' && S.hook > 0.05 && Math.abs(o.x - S.x) < 0.12 && o.y > RY - S.hook && o.y < RY) Sea.loot(o);
    }
    S.objs = S.objs.filter(o => !o.dead && o.y < 1.15);
    if (S.msgT > 0) S.msgT -= dt;
    if (S.hp <= 0) { Sea.S = null; UI.onIsland(); G.seaDone(false); return; }
    if (S.t >= S.dur) { Sea.S = null; SFX.play('fanfare'); G.seaDone(true); }
  },
  loot(o) {
    o.dead = true;
    if (Math.random() < SEA.rareFlagChance && !G.s.deco.flag) { G.s.deco.flag = true; Sea.msg('Hòm trôi: lá cờ trang trí bè!'); SFX.play('fanfare'); return; }
    const [id, n] = SEA.loot[Math.floor(Math.random() * SEA.loot.length)];
    const left = G.giveRaw(id, n);
    Sea.msg(left < n ? 'Vớt được ' + (n - left) + ' ' + ITEMS[id].n : 'Túi đầy, đành bỏ ' + ITEMS[id].n);
    SFX.play('pick');
  },
  msg(t) { Sea.S.msg = t; Sea.S.msgT = 2.5; },
  render(c, W, H, dpr) {
    const S = Sea.S; if (!S) return;
    const t = G.time;
    c.setTransform(1, 0, 0, 1, 0, 0);
    const spd = SEA.scrollSpeed * RAFT[G.s.raft].speed;
    R.tile(c, S.storm ? 'sea_bg_storm' : 'sea_bg', W, H, 0, S.scroll * spd * H, 2 * dpr);
    const fw = Math.min(W, H * 1.3), ox = (W - fw) / 2;
    const X = x => ox + fw / 2 + x * fw * 0.45, Y = y => y * H;
    const sc = dpr * Math.min(1.6, H / dpr / 380);
    for (const o of S.objs) {
      const D = SEA.objects[o.type];
      let alpha = 1;
      if (o.type === 'reef' && !S.compass) alpha = U.clamp((o.y - 0.45) / 0.15, 0, 1);
      if (o.type === 'reef' && alpha < 0.3) R.spr(c, 'sea_ripple', X(o.x), Y(o.y), { scale: sc, alpha: 0.5 + Math.sin(t * 6) * 0.3 });
      R.spr(c, D.sprite, X(o.x), Y(o.y) - (o.jump ? 20 * sc : 0), { scale: sc, alpha });
    }
    const rx = X(S.x), ry = Y(SEA.raftY);
    R.spr(c, 'sea_wake', rx, ry + 20 * sc, { scale: sc });
    c.save(); c.translate(rx, ry); c.scale(sc, sc); c.rotate(S.vx * 0.15);
    G.drawRaft(c, 0, 0, 1);
    R.spr(c, 'player_' + (G.s.gender === 'f' ? 'f' : 'm') + '_up_0', -4, 14);
    if (G.s.parrot.friend) R.spr(c, 'parrot_0', 16, -12);
    c.restore();
    if (S.hook > 0) {
      const top = Y(SEA.raftY - S.hook);
      for (let y = ry - 20 * sc; y > top; y -= 8 * sc) R.spr(c, 'hook', rx, y, { scale: sc * 0.5, alpha: 0.6 });
      R.spr(c, 'hook', rx, top, { scale: sc * 1.2 });
    }
    if (S.storm) R.tile(c, 'rain', W, H, -t * 300 * dpr, t * 900 * dpr, 2 * dpr);
    UI.seaHud(S);
  },
};
