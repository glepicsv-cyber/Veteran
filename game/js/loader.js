// Người Đi Trước — nạp dữ liệu JSON, ảnh và âm thanh trước khi vào game
'use strict';
const Assets = {
  spr: {},        // khóa -> { cv, w, h, ax, ay } hoặc { frames, fps }
  audio: {},      // khóa -> ArrayBuffer (giải mã khi bật âm thanh)
  icon: {},       // id vật phẩm -> canvas icon
  async fetchJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Không tải được ' + url);
    return r.json();
  },
  // Ảnh SVG/PNG được raster hóa một lần vào canvas để vẽ nhanh
  loadImage(key, def, k) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(def.w * k)); cv.height = Math.max(1, Math.round(def.h * k));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        Assets.spr[key] = { cv, w: def.w, h: def.h, ax: def.ax ?? 0.5, ay: def.ay ?? 0.95 };
        res();
      };
      img.onerror = () => { console.warn('Thiếu ảnh', def.src); res(); };
      img.src = 'assets/' + def.src;
    });
  },
  async loadAll(progress) {
    const data = {};
    const keys = Object.keys(DATA_FILES);
    const sprites = await Assets.fetchJSON('assets/sprites.json');
    const audio = await Assets.fetchJSON('assets/audio.json');
    const imgKeys = Object.keys(sprites).filter(k => sprites[k].src);
    const total = keys.length + imgKeys.length + Object.keys(audio).length;
    let done = 0;
    const tick = () => { done++; progress(done / total); };
    await Promise.all(keys.map(async k => { data[k] = await Assets.fetchJSON(DATA_FILES[k]); tick(); }));
    applyData(data);
    await Promise.all(imgKeys.map(async k => {
      const d = sprites[k];
      const scale = d.src.includes('/tiles/') || d.src.includes('/bg/') ? 1 : 2;
      await Assets.loadImage(k, d, scale); tick();
    }));
    for (const k in sprites) if (sprites[k].frames) Assets.spr[k] = sprites[k];
    // icon vật phẩm dùng khi vẽ đồ rơi trên mặt đất
    await Promise.all(Object.keys(ITEMS).map(id => new Promise(res => {
      const img = new Image();
      img.onload = () => { const cv = document.createElement('canvas'); cv.width = cv.height = 48; cv.getContext('2d').drawImage(img, 0, 0, 48, 48); Assets.icon[id] = cv; res(); };
      img.onerror = () => res();
      img.src = iconUrl(id);
    })));
    await Promise.all(Object.keys(audio).map(async k => {
      try { Assets.audio[k] = await (await fetch('assets/' + audio[k])).arrayBuffer(); } catch (e) { console.warn('Thiếu âm thanh', k); }
      tick();
    }));
  },
};
const iconUrl = id => 'assets/img/icons/' + id + '.svg';
const iconImg = (id, cls) => '<img class="' + (cls || 'icon') + '" src="' + iconUrl(id) + '" alt="">';
