// Người Đi Trước — tiện ích dùng chung và bản đồ ô
'use strict';
let TS = 32; // kích thước 1 ô (đơn vị thế giới), lấy từ data/config.json

const U = {
  clamp: (v, a, b) => v < a ? a : v > b ? b : v,
  lerp: (a, b, t) => a + (b - a) * t,
  dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
  fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  },
  rng(seed) {
    let a = seed >>> 0 || 1;
    const f = () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    f.int = (a0, b0) => Math.floor(a0 + f() * (b0 - a0 + 1));
    return f;
  },
  hash2(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  },
  copy: o => o == null ? o : JSON.parse(JSON.stringify(o)),
  // Thay {khóa} trong chuỗi bằng giá trị
  fill: (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => vars[k] != null ? vars[k] : m),
};

// Loại ô: T.SAND -> chỉ số; TILES[chỉ số] -> thông tin (nạp từ data/tiles.json)
const T = {};
const TILES = [];
const TILE_BY_CH = {};
function initTiles(def) {
  Object.keys(def).forEach((k, i) => {
    T[k] = i;
    TILES[i] = def[k];
    TILE_BY_CH[def[k].ch] = i;
  });
}

// Bản đồ ô, dựng từ dữ liệu đảo (data/islands/islandN.json)
class TileMap {
  constructor(D) {
    this.w = D.w; this.h = D.h;
    const n = this.w * this.h;
    this.t = new Uint8Array(n);
    this.low = new Uint8Array(n);   // vùng trũng (ngập khi triều lên)
    this.tag = new Uint8Array(n);   // nhãn (dải dung nham)
    this.zone = new Int8Array(n).fill(-1);
    this.zones = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = y * this.w + x;
      const t = TILE_BY_CH[D.map[y][x]];
      this.t[i] = t == null ? T.DEEP : t;
      if (D.low) this.low[i] = +D.low[y][x];
      if (D.tag) this.tag[i] = +D.tag[y][x];
    }
    for (const z of D.zones) this.addZone(z);
  }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inb(x, y) ? this.t[y * this.w + x] : T.DEEP; }
  addZone(z) {
    const zi = this.zones.length;
    this.zones.push(z);
    for (let y = Math.floor(z.cy - z.r); y <= z.cy + z.r; y++)
      for (let x = Math.floor(z.cx - z.r); x <= z.cx + z.r; x++)
        if (this.inb(x, y) && Math.hypot(x + 0.5 - z.cx, y + 0.5 - z.cy) <= z.r && this.get(x, y) !== T.DEEP) this.zone[y * this.w + x] = zi;
  }
  zoneAt(x, y) {
    if (!this.inb(x, y)) return null;
    const z = this.zone[y * this.w + x];
    return z < 0 ? null : this.zones[z];
  }
  zoneById(id) { return this.zones.find(z => z.id === id); }
}
