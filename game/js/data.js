// Người Đi Trước — dữ liệu game (nạp từ thư mục data/) và bộ đọc điều kiện
'use strict';
let CFG, ITEMS, RECIPES, STATION_NAME, RAFT, PAGES, LETTER, RELICS, ENDINGS, STORY, SEA, LOOKS;
const ISLAND_DATA = [];

const STACK = id => (ITEMS[id].type === 'tool' || ITEMS[id].type === 'wear') ? 1 : (ITEMS[id].stack || 10);

const DATA_FILES = {
  config: 'data/config.json', tiles: 'data/tiles.json', items: 'data/items.json', recipes: 'data/recipes.json',
  raft: 'data/raft.json', journal: 'data/journal.json', endings: 'data/endings.json', story: 'data/story.json',
  sea: 'data/sea.json', looks: 'data/looks.json',
  island1: 'data/islands/island1.json', island2: 'data/islands/island2.json', island3: 'data/islands/island3.json',
  island4: 'data/islands/island4.json', island5: 'data/islands/island5.json',
};

function applyData(d) {
  CFG = d.config; TS = CFG.tileSize;
  initTiles(d.tiles);
  ITEMS = d.items;
  RECIPES = d.recipes.recipes; STATION_NAME = d.recipes.stations;
  RECIPES.forEach(r => { if (!r.n) r.n = ITEMS[Object.keys(r.out)[0]].n; });
  RAFT = d.raft;
  PAGES = d.journal.pages; LETTER = d.journal.letter; RELICS = d.journal.relics;
  ENDINGS = d.endings; STORY = d.story; SEA = d.sea; LOOKS = d.looks;
  for (let n = 1; n <= 5; n++) ISLAND_DATA[n] = d['island' + n];
}

// Điều kiện nhiệm vụ viết trong JSON, ví dụ {"count":"debris","n":3}, {"all":[...]}
const Cond = {
  ok(c) {
    if (!c) return false;
    if (c.all) return c.all.every(Cond.ok);
    if (c.any) return c.any.some(Cond.ok);
    if (c.not) return !Cond.ok(c.not);
    if (c.count) return (G.s.counts[c.count] || 0) >= (c.n || 1);
    if (c.flag) return G.f(c.flag);
    if (c.has) return G.has(c.has, c.n || 1);
    if (c.raft) return G.s.raft >= c.raft;
    if (c.page) return !!G.s.pages[c.page];
    if (c.explore) return G.explorePct() >= c.explore;
    if (c.zone) return G.zoneId() === c.zone;
    if (c.invSize) return G.s.invSize >= c.invSize;
    return false;
  },
  // Mẫu tiến độ, ví dụ "{c:debris}/3", "{i:palm_trunk}/10", "{f:net_cut|có|chưa}"
  tpl(s) {
    if (!s) return '';
    return s.replace(/\{([^}]+)\}/g, (m, k) => {
      const p = k.split(':');
      switch (p[0]) {
        case 'c': return G.s.counts[p[1]] || 0;
        case 'cmin': return Math.min(+p[2], G.s.counts[p[1]] || 0);
        case 'i': return G.count(p[1]);
        case 'fed': return G.s.parrot.fed;
        case 'explore': return Math.floor(G.explorePct());
        case 'f': { const [fl, yes, no] = k.slice(2).split('|'); return G.f(fl) ? yes : no; }
      }
      return m;
    });
  },
  reward(r) {
    if (!r) return;
    if (r.flag) G.flag(r.flag);
    if (r.deco) G.s.deco[r.deco] = true;
    if (r.toast) G.toast(r.toast);
  },
};

// Lời thoại từ data/story.json: thay {name}, lọc theo điều kiện Mõ
function storyLines(key, vars) {
  const v = Object.assign({ name: G.s ? G.s.name : '' }, vars || {});
  const friend = G.s && G.s.parrot && G.s.parrot.friend;
  const src = Array.isArray(key) ? key : STORY[key];
  return src.filter(l => !(l.ifParrot && !friend) && !(l.ifNoParrot && friend))
    .map(l => ({ who: U.fill(l.who, v), text: U.fill(l.text, v) }));
}
