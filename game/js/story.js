// Người Đi Trước — cốt truyện: lời thoại lấy từ data/story.json, cảnh kết dựng bằng ảnh asset
'use strict';
const Story = {
  intro(cb) { UI.dialog(storyLines('intro', { name: G.s0name }), cb); },
  intro2() { UI.dialog(storyLines('wakeUp')); },
  mo(text) {
    if (!text) return;
    G.mo.say = (G.s.parrot.friend ? '' : '💭 ') + text;
    G.mo.sayT = 4.5;
    if (G.s.parrot.friend) SFX.play('parrot');
  },
  meetLam() {
    G.flag('met_lam');
    SFX.play('fanfare');
    UI.dialog(storyLines('meetLam'), () => G.pickPage('p5_4'));
  },
  talkLam() {
    if (!G.f('met_lam')) { Story.meetLam(); return; }
    const I = STORY.invite;
    if (!G.f('net_cut')) { UI.dialog(storyLines(G.has('iron_knife') ? STORY.lamNet.concat(STORY.lamNetIron) : STORY.lamNet)); return; }
    const pages = Object.keys(G.s.pages).length, fish = !!G.s.relics.iron_fish, hooks = G.f('hooks_cut');
    const agree = hooks && pages >= 16 && fish;
    if (G.f('invited')) { UI.dialog(storyLines(agree ? I.afterAgree : I.afterStay)); return; }
    const lines = [I.ask, pages >= 16 ? I.manyPages : I.fewPages];
    if (fish) lines.push(I.fish);
    lines.push(...(!hooks ? I.hooksLeft : agree ? I.agree : I.stay));
    UI.dialog(storyLines(lines, { pages }), () => G.flag('invited'));
  },
  turtleDives() {
    if (G.rt.diving) return;
    G.rt.diving = true;
    SFX.play('rumble'); G.shake(2);
    UI.dialog(storyLines('turtleDives'), () => G.restoreSnapshot());
  },
  ending() {
    const pages = Object.keys(G.s.pages).length;
    const full = G.f('net_cut') && G.f('hooks_cut');
    if (full && pages >= 16 && G.s.relics.iron_fish) return G.f('baby_turtle') ? 'secret' : 'together';
    if (full) return 'stay';
    return 'alone';
  },
  finale() {
    const key = Story.ending();
    G.s.ending = key;
    G.s.phase = 'end';
    G.wipe();
    const m = G.meta(); G.setMeta('finished', (m.finished || 0) + 1);
    if (key === 'secret' || key === 'together') G.setMeta('challenge', true);
    Story.endT = 0;
    UI.onEnd();
    const E = ENDINGS[key === 'secret' ? 'together' : key];
    const lines = E.lines.map(t => ({ who: '', text: t }));
    if (key !== 'alone') lines.push({ who: 'Thư gửi Bống', text: LETTER });
    if (key === 'secret') ENDINGS.secret.lines.forEach(t => lines.push({ who: '', text: t }));
    UI.dialog(lines, () => UI.endCard(key));
  },
  // Cảnh kết: nền + rùa/bè/nhân vật (đều là ảnh)
  renderEnd(c, W, H, dpr) {
    const t = G.time, key = G.s.ending;
    Story.endT += 1 / 60;
    c.setTransform(1, 0, 0, 1, 0, 0);
    R.cover(c, 'bg_end', W, H);
    const s = dpr * Math.min(2, H / dpr / 300);
    const rx = W * 0.55 - Math.min(Story.endT * 8, W * 0.2), ry = H * 0.68 + Math.sin(t * 1.5) * 4 * dpr;
    c.save(); c.translate(rx, ry); c.scale(s, s);
    const together = key === 'together' || key === 'secret';
    if (together) R.spr(c, 'turtle_big', 0, 30);
    G.drawRaft(c, 10, 0, 0.9);
    const ps = 'player_' + (G.s.gender === 'f' ? 'f' : 'm') + '_side_0';
    R.spr(c, ps, -8, 14, { flip: true });
    if (together) R.spr(c, 'lam', 26, 14);
    if (G.s.parrot.friend) R.spr(c, 'parrot_fly', 0, -46 + Math.sin(t * 3) * 5, { t });
    c.restore();
    if (key === 'secret') R.spr(c, 'turtle_small', rx + 170 * s, ry + 40 * s, { scale: s });
    if (key === 'stay') { R.spr(c, 'turtle_big', W * 0.86, H * 0.5, { scale: s * 0.4 }); R.spr(c, 'lam', W * 0.86, H * 0.47, { scale: s * 0.5 }); }
  },
  // Ảnh chia sẻ cuối game
  shareImage(key) {
    const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 608;
    const c = cv.getContext('2d');
    R.cover(c, 'bg_share', 1080, 608);
    c.save(); c.translate(290, 360); c.scale(3, 3);
    G.drawRaft(c, 0, 0, 1);
    const g = G.s.gender === 'f' ? 'f' : 'm';
    R.spr(c, 'player_' + g + '_down_0', -10, 16);
    if (key === 'together' || key === 'secret') R.spr(c, 'lam', 12, 16);
    if (G.s.parrot.friend) R.spr(c, 'parrot_0', 18, -34);
    c.restore();
    const E = ENDINGS[key];
    c.textAlign = 'left';
    c.fillStyle = '#ffe9b0'; c.font = 'bold 30px Georgia,serif'; c.fillText('NGƯỜI ĐI TRƯỚC', 600, 125);
    c.fillStyle = '#fff'; c.font = 'bold 44px Georgia,serif'; c.fillText(E.n, 600, 200);
    c.font = '22px system-ui,sans-serif'; c.fillStyle = '#ffd98a'; c.fillText(E.tag, 600, 235);
    c.font = '26px system-ui,sans-serif';
    const pages = Object.keys(G.s.pages).length;
    const rows = [['Người chơi', G.s.name], ['Số ngày sống sót', String(G.day())], ['Trang nhật ký', pages + ' / 20'], ['Bè cuối cùng', RAFT[G.s.raft].cap + ' ô · ' + (G.s.raft >= 4 ? 'có buồm' : 'cấp ' + G.s.raft)], ['Di vật', G.s.relics.iron_fish ? RELICS.iron_fish.n : '—']];
    rows.forEach((r, i) => { c.fillStyle = '#cfe6f2'; c.fillText(r[0], 600, 300 + i * 46); c.fillStyle = '#fff'; c.textAlign = 'right'; c.fillText(r[1], 1000, 300 + i * 46); c.textAlign = 'left'; });
    return cv;
  },
};
