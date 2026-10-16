// Người Đi Trước — phát âm thanh từ tệp trong assets/audio (danh sách: assets/audio.json)
'use strict';
const SFX = {
  ctx: null, master: null, muted: false, buf: {}, amb: null,
  // Gọi khi người chơi chạm lần đầu (trình duyệt chặn âm thanh tự phát)
  init() {
    if (SFX.ctx) { if (SFX.ctx.state === 'suspended') SFX.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    SFX.ctx = new AC();
    SFX.master = SFX.ctx.createGain();
    SFX.master.gain.value = SFX.muted ? 0 : 0.8;
    SFX.master.connect(SFX.ctx.destination);
    for (const k in Assets.audio) {
      SFX.ctx.decodeAudioData(Assets.audio[k].slice(0), b => { SFX.buf[k] = b; if (k === 'ambient_sea') SFX.ambient(); }, () => console.warn('Không giải mã được', k));
    }
  },
  setMuted(m) { SFX.muted = m; if (SFX.master) SFX.master.gain.value = m ? 0 : 0.8; },
  source(name, vol, dest) {
    const b = SFX.buf[name]; if (!b || !SFX.ctx) return null;
    const s = SFX.ctx.createBufferSource(); s.buffer = b;
    const g = SFX.ctx.createGain(); g.gain.value = vol;
    s.connect(g); g.connect(dest || SFX.master);
    return s;
  },
  play(name, vol = 1) {
    if (SFX.muted) return;
    const s = SFX.source(name, vol);
    if (s) s.start();
  },
  // Chuông gió có hướng trái/phải và nhỏ dần theo khoảng cách (đảo 4)
  chime(dx, dist, mine) {
    if (!SFX.ctx || SFX.muted) return;
    const vol = Math.max(0, 1 - dist / 22);
    if (vol <= 0.02) return;
    let dest = SFX.master;
    if (SFX.ctx.createStereoPanner) { const p = SFX.ctx.createStereoPanner(); p.pan.value = U.clamp(dx / 8, -1, 1); p.connect(SFX.master); dest = p; }
    const s = SFX.source(mine ? 'chime_mine' : 'chime', vol, dest);
    if (s) s.start();
  },
  ambient() {
    if (SFX.amb) return;
    const s = SFX.source('ambient_sea', 0.35);
    if (!s) return;
    s.loop = true; s.start();
    SFX.amb = s;
  },
};
