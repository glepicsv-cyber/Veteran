// Người Đi Trước — điều khiển và vòng lặp chính
'use strict';
const Input = {
  keys: {}, joy: { x: 0, y: 0, on: false, id: null, ox: 0, oy: 0 }, runToggle: false, hold: false,
  get run() { return !!Input.keys.shift || Input.runToggle; },
  vec() {
    const k = Input.keys;
    let x = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0);
    let y = (k.s || k.arrowdown ? 1 : 0) - (k.w || k.arrowup ? 1 : 0);
    if (x || y) { const l = Math.hypot(x, y); return { x: x / l, y: y / l }; }
    if (Input.joy.on) return { x: Input.joy.x, y: Input.joy.y };
    return { x: 0, y: 0 };
  },
  init() {
    addEventListener('keydown', e => {
      const key = e.key.toLowerCase();
      if (e.target.tagName === 'INPUT') return;
      Input.keys[key] = true;
      if (UI.dOpen) { if ((key === ' ' || key === 'enter' || key === 'e') && !e.repeat) UI.nextLine(); e.preventDefault(); return; }
      if (key === 'escape') { if (UI.panelKind) UI.closePanels(); else if (G.s && G.s.phase === 'island') UI.openMenu(); return; }
      if (!G.s || (G.s.phase !== 'island' && G.s.phase !== 'sea')) return;
      if ((key === ' ' || key === 'e') && !e.repeat) { Input.hold = true; if (G.s.phase === 'island' && !UI.panelKind) G.interact(0); e.preventDefault(); }
      if (G.s.phase !== 'island') return;
      if (key === 'q' || key === 'f') G.interact(1);
      const toggle = (kind, open) => { if (UI.panelKind === kind) UI.closePanels(); else { UI.closePanels(); open(); } };
      if (key === 'c') toggle('craft', UI.openCraft);
      if (key === 'i' || key === 'tab') { toggle('inv', UI.openInv); e.preventDefault(); }
      if (key === 'j') toggle('journal', () => UI.openJournal());
      if (key === 'm') toggle('map', UI.openMap);
    });
    addEventListener('keyup', e => { const key = e.key.toLowerCase(); Input.keys[key] = false; if (key === ' ' || key === 'e') Input.hold = false; });
    addEventListener('blur', () => { Input.keys = {}; Input.hold = false; Input.joy.on = false; });
    // Cần điều khiển ảo: chạm bất kỳ đâu ở nửa trái
    const zone = $('#joy'), base = $('#joyBase'), knob = $('#joyKnob');
    const R0 = 52;
    zone.addEventListener('pointerdown', e => {
      SFX.init();
      const J = Input.joy; J.on = true; J.id = e.pointerId; J.ox = e.clientX; J.oy = e.clientY; J.x = J.y = 0;
      base.style.left = e.clientX + 'px'; base.style.top = e.clientY + 'px'; base.classList.add('on');
      knob.style.transform = 'translate(-50%,-50%)';
      zone.setPointerCapture(e.pointerId); e.preventDefault();
    });
    zone.addEventListener('pointermove', e => {
      const J = Input.joy; if (!J.on || e.pointerId !== J.id) return;
      let dx = e.clientX - J.ox, dy = e.clientY - J.oy; const l = Math.hypot(dx, dy);
      if (l > R0) { dx = dx / l * R0; dy = dy / l * R0; }
      J.x = dx / R0; J.y = dy / R0;
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    });
    const end = e => { const J = Input.joy; if (e.pointerId !== J.id) return; J.on = false; J.x = J.y = 0; base.classList.remove('on'); };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    const bA = $('#bAct');
    bA.addEventListener('pointerdown', e => { e.preventDefault(); SFX.init(); Input.hold = true; if (G.s && G.s.phase === 'island') G.interact(0); });
    const up = () => { Input.hold = false; };
    bA.addEventListener('pointerup', up); bA.addEventListener('pointercancel', up); bA.addEventListener('pointerleave', up);
    $('#bAct2').addEventListener('pointerdown', e => { e.preventDefault(); G.interact(1); });
    $('#bRun').addEventListener('pointerdown', e => { e.preventDefault(); Input.runToggle = !Input.runToggle; });
    document.addEventListener('contextmenu', e => e.preventDefault());
  },
};

const Main = {
  cv: null, c: null, dpr: 1, W: 0, H: 0, last: 0, ready: false,
  async init() {
    Main.cv = $('#cv'); Main.c = Main.cv.getContext('2d');
    addEventListener('resize', Main.resize); Main.resize();
    try {
      await Assets.loadAll(p => { $('#loadbar span').style.width = Math.round(p * 100) + '%'; });
    } catch (err) {
      console.error(err);
      $('#loading p').textContent = 'Không tải được dữ liệu game. Hãy chạy qua máy chủ web (xem README).';
      return;
    }
    buildIslands();
    Main.resize();
    $('#loading').classList.add('hidden');
    Main.ready = true;
    SFX.muted = !!G.meta().muted;
    Input.init(); UI.init();
    addEventListener('visibilitychange', () => { if (document.hidden) G.save(); });
    addEventListener('pagehide', () => G.save());
    requestAnimationFrame(Main.loop);
  },
  resize() {
    Main.dpr = Math.min(2, devicePixelRatio || 1);
    Main.W = Main.cv.width = Math.floor(innerWidth * Main.dpr);
    Main.H = Main.cv.height = Math.floor(innerHeight * Main.dpr);
    G.zoom = U.clamp(Math.min(innerWidth / (TS * 18), innerHeight / (TS * 10.5)), 0.8, 2.4);
  },
  loop(ts) {
    const dt = Math.min(0.05, (ts - Main.last) / 1000 || 0.016);
    Main.last = ts;
    const c = Main.c, W = Main.W, H = Main.H;
    try {
      G.paused = UI.modal();
      if (G.s && (G.s.phase === 'island' || G.s.phase === 'sea')) {
        G.update(dt);
        if (G.s && (G.s.phase === 'island' || G.s.phase === 'sea')) G.render(c, W, H, Main.dpr);
      } else if (G.s && G.s.phase === 'end') { G.time += dt; Story.renderEnd(c, W, H, Main.dpr); }
      else Main.titleBg(c, W, H, ts / 1000);
      UI.frame(dt);
    } catch (err) { console.error(err); }
    requestAnimationFrame(Main.loop);
  },
  // Màn hình tiêu đề: ảnh nền + bè và vẹt động
  titleBg(c, W, H, t) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    R.cover(c, 'bg_title', W, H);
    const s = Main.dpr * Math.min(1.8, H / Main.dpr / 360);
    c.save(); c.translate(W * 0.25, H * 0.72 + Math.sin(t * 1.2) * 4 * Main.dpr); c.scale(s * 1.3, s * 1.3); c.rotate(Math.sin(t) * 0.04);
    R.spr(c, 'raft_4', 0, 0);
    c.restore();
    R.spr(c, 'parrot_fly', W * 0.25 + Math.cos(t * 0.7) * 80 * s, H * 0.42 + Math.sin(t * 1.3) * 20 * s, { t, scale: s * 1.2 });
  },
};
addEventListener('load', Main.init);
