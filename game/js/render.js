// Người Đi Trước — vẽ bằng ảnh asset: sprite, khung hoạt hình, nền địa hình
'use strict';
const R = {
  // Lấy khung ảnh (hỗ trợ hoạt hình { frames, fps })
  frame(key, t, phase) {
    const s = Assets.spr[key];
    if (!s) return null;
    if (s.frames) return Assets.spr[s.frames[Math.floor((t || 0) * s.fps + (phase || 0)) % s.frames.length]];
    return s;
  },
  // Vẽ sprite tại (x,y) theo điểm neo; o: { t, phase, flip, scale, alpha }
  spr(c, key, x, y, o) {
    o = o || {};
    const s = R.frame(key, o.t, o.phase);
    if (!s) return;
    const sc = o.scale || 1, w = s.w * sc, h = s.h * sc;
    if (o.alpha != null) c.globalAlpha = o.alpha;
    if (o.flip) {
      c.save(); c.translate(x, y); c.scale(-1, 1);
      c.drawImage(s.cv, -w * s.ax, -h * s.ay, w, h);
      c.restore();
    } else c.drawImage(s.cv, x - w * s.ax, y - h * s.ay, w, h);
    if (o.alpha != null) c.globalAlpha = 1;
  },
  // Vẽ ảnh phủ kín một vùng (nền)
  cover(c, key, W, H) {
    const s = Assets.spr[key]; if (!s) return;
    const k = Math.max(W / s.w, H / s.h);
    c.drawImage(s.cv, (W - s.w * k) / 2, (H - s.h * k) / 2, s.w * k, s.h * k);
  },
  // Lát ảnh lặp (biển, mưa), có dịch chuyển
  tile(c, key, W, H, ox, oy, k) {
    const s = Assets.spr[key]; if (!s) return;
    k = k || 1;
    const tw = s.w * k, th = s.h * k;
    ox = ((ox % tw) + tw) % tw; oy = ((oy % th) + th) % th;
    for (let y = -th + oy; y < H; y += th) for (let x = -tw + ox; x < W; x += tw) c.drawImage(s.cv, x, y, tw, th);
  },
  // Dựng sẵn nền địa hình từ ảnh ô: mỗi lớp tô bằng mẫu ảnh, viền bo tròn sang lớp thấp hơn
  prerender(map) {
    const cv = document.createElement('canvas');
    cv.width = map.w * TS; cv.height = map.h * TS;
    const c = cv.getContext('2d');
    const pat = {};
    const pattern = t => {
      if (pat[t] === undefined) { const s = R.frame(TILES[t].img, 0); pat[t] = s ? c.createPattern(s.cv, 'repeat') : TILES[t].color; }
      return pat[t];
    };
    c.fillStyle = pattern(T.DEEP); c.fillRect(0, 0, cv.width, cv.height);
    const layers = {};
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const t = map.get(x, y);
      if (t === T.DEEP) continue;
      (layers[TILES[t].layer] = layers[TILES[t].layer] || []).push([x, y, t]);
    }
    for (const L of Object.keys(layers).map(Number).sort((a, b) => a - b)) {
      for (const [x, y, t] of layers[L]) {
        c.fillStyle = pattern(t);
        c.fillRect(x * TS, y * TS, TS, TS);
        c.beginPath(); c.arc(x * TS + TS / 2, y * TS + TS / 2, TS * 0.74, 0, Math.PI * 2); c.fill();
      }
    }
    return cv;
  },
};
