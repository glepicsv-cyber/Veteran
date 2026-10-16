// Người Đi Trước — giao diện DOM
'use strict';
const $ = s => document.querySelector(s);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

const UI = {
  dirty: true, dq: [], dOpen: false, panelKind: null, qT: 0,
  init() {
    $('#bInv').onclick = () => UI.openInv();
    $('#bCraft').onclick = () => UI.openCraft();
    $('#bJournal').onclick = () => UI.openJournal();
    $('#bMap').onclick = () => UI.openMap();
    $('#bMenu').onclick = () => UI.openMenu();
    $('#panel .x').onclick = () => UI.closePanels();
    $('#panel').addEventListener('pointerdown', e => { if (e.target.id === 'panel') UI.closePanels(); });
    $('#dialog').addEventListener('pointerdown', e => { e.preventDefault(); UI.nextLine(); });
    UI.title();
  },
  modal() { return UI.dOpen || UI.panelKind || !$('#card').classList.contains('hidden') || !$('#title').classList.contains('hidden') || (G.s && G.s.phase === 'end'); },

  // ---------- Màn hình tiêu đề ----------
  title() {
    const T0 = $('#title'); T0.classList.remove('hidden');
    $('#hud').classList.add('hidden');
    const meta = G.meta();
    const b = T0.querySelector('.tbtns'); b.innerHTML = '';
    if (G.hasSave()) { const c = h('button', 'big', '▶ Tiếp tục'); c.onclick = () => { SFX.init(); T0.classList.add('hidden'); if (!G.load()) UI.title(); }; b.appendChild(c); }
    const n = h('button', 'big' + (G.hasSave() ? ' alt' : ''), '✦ Hành trình mới'); n.onclick = () => { SFX.init(); UI.newForm(false); }; b.appendChild(n);
    if (meta.challenge) { const ch = h('button', 'big alt', '⚡ Chế độ Thử thách'); ch.onclick = () => { SFX.init(); UI.newForm(true); }; b.appendChild(ch); }
    T0.querySelector('.tform').classList.add('hidden');
    b.classList.remove('hidden');
  },
  newForm(challenge) {
    const T0 = $('#title'), fm = T0.querySelector('.tform');
    T0.querySelector('.tbtns').classList.add('hidden');
    fm.classList.remove('hidden');
    fm.innerHTML = `
      <label>Tên nhân vật <input id="fName" maxlength="14" value="Minh"></label>
      <div class="seg" id="fGender"><button data-v="m" class="on">Nam</button><button data-v="f">Nữ</button></div>
      <div class="seg" id="fHard"><button data-v="0" class="on">Thường</button><button data-v="1">Khó</button></div>
      <p class="note" id="fNote">Thường: gục ngã thì hồi sinh ở trại gần nhất, mất nửa nguyên liệu.</p>
      ${challenge ? '<p class="note">Thử thách: thêm biến số ngẫu nhiên — hạn hán, đêm dài gấp đôi hoặc bão liên tục.</p>' : ''}
      <div class="row"><button class="big alt" id="fBack">Quay lại</button><button class="big" id="fGo">Bắt đầu</button></div>`;
    let gender = 'm', hard = false;
    fm.querySelectorAll('#fGender button').forEach(bt => bt.onclick = () => { gender = bt.dataset.v; fm.querySelectorAll('#fGender button').forEach(x => x.classList.toggle('on', x === bt)); });
    fm.querySelectorAll('#fHard button').forEach(bt => bt.onclick = () => {
      hard = bt.dataset.v === '1'; fm.querySelectorAll('#fHard button').forEach(x => x.classList.toggle('on', x === bt));
      $('#fNote').textContent = hard ? 'Khó: gục ngã thì chơi lại từ đầu hòn đảo đó.' : 'Thường: gục ngã thì hồi sinh ở trại gần nhất, mất nửa nguyên liệu.';
    });
    $('#fBack').onclick = () => UI.title();
    $('#fGo').onclick = () => {
      const name = ($('#fName').value || 'Minh').trim().slice(0, 14) || 'Minh';
      let mods = {};
      if (challenge) { const opts = [{ drought: 1 }, { longNight: 1 }, { storms: 1 }]; mods = opts[Math.floor(Math.random() * 3)]; }
      T0.classList.add('hidden');
      G.wipe();
      G.s0name = name;
      G.s = { name, parrot: { friend: false }, phase: 'intro' };
      Story.intro(() => {
        G.newGame({ name, gender, hard, mods });
        if (challenge) G.toast('Biến số thử thách: ' + (mods.drought ? 'Hạn hán (khát nhanh x1,5)' : mods.longNight ? 'Đêm dài gấp đôi' : 'Bão liên tục trên biển'));
      });
    };
  },

  // ---------- HUD ----------
  onIsland() {
    $('#hud').classList.remove('hidden');
    $('#hud').classList.remove('sea');
    $('#seaHud').classList.add('hidden');
    UI.dirty = true;
  },
  onSea() { $('#hud').classList.add('sea'); $('#seaHud').classList.remove('hidden'); UI.bubble(null); },
  onEnd() { $('#hud').classList.add('hidden'); UI.bubble(null); },
  frame(dt) {
    if (!G.s || G.s.phase !== 'island') { if (G.s && G.s.phase === 'sea') UI.seaButtons(); return; }
    const st = G.s.st;
    const setBar = (k, v, warn) => { const b = document.querySelector('.bar[data-k="' + k + '"]'); if (!b) return; b.querySelector('span').style.width = U.clamp(v, 0, 100) + '%'; b.classList.toggle('warn', !!warn); };
    setBar('hp', st.hp, st.hp < 25); setBar('hunger', st.hunger, st.hunger < 20); setBar('thirst', st.thirst, st.thirst < 20); setBar('sta', st.sta, st.sta < 15);
    const heatBar = document.querySelector('.bar[data-k="heat"]');
    heatBar.classList.toggle('hidden', G.s.island !== 3);
    if (G.s.island === 3) setBar('heat', st.heat || 0, st.heat > 80);
    UI.qT -= dt;
    if (UI.qT <= 0 || UI.dirty) {
      UI.qT = 0.3;
      const D = G.ISL, I = G.s.isl;
      $('#islname').textContent = 'Đảo ' + D.n + ' · ' + D.name + (G.zoneName() ? ' — ' + G.zoneName() : '');
      const L = G.dayLen(), p = G.s.time % L;
      const hh = Math.floor(6 + p / L * 24) % 24, mm = Math.floor((p / L * 24 * 60) % 60);
      $('#clock').textContent = (G.isNight() ? '🌙' : '☀️') + ' Ngày ' + G.day() + ' · ' + String(hh).padStart(2, '0') + ':' + String(Math.floor(mm / 10) * 10).padStart(2, '0');
      $('#rule').textContent = D.hud ? D.hud() : '';
      const q = D.main[I.q];
      let html = '';
      if (q) html += '<div class="qm"><b>' + (I.q + 1) + '/7 · ' + esc(q.t) + '</b><div>' + esc(q.d) + (q.p ? ' <em>(' + esc(Cond.tpl(q.p)) + ')</em>' : '') + '</div></div>';
      else html += '<div class="qm"><b>Đã xong 7 nhiệm vụ!</b><div>Ra bãi đóng bè để ra khơi.</div></div>';
      if (G.s.raftBroken) html += '<div class="qs warn">Bè hỏng — sửa ở bãi đóng bè</div>';
      $('#quest').innerHTML = html;
    }
    // Nút hành động
    const acts = G.targetActs || [];
    const a0 = G.target ? acts[0] : null, a1 = G.target ? acts[1] : null;
    const b0 = $('#bAct'), b1 = $('#bAct2');
    const lab = a => a.l + (G.actNeedOK(a) ? ' 🔒' : '');
    const t0 = a0 ? lab(a0) : 'Tương tác';
    if (b0.dataset.l !== t0) { b0.dataset.l = t0; b0.textContent = t0; }
    b0.classList.toggle('dim', !a0);
    if (a1) { const t1 = lab(a1); if (b1.dataset.l !== t1) { b1.dataset.l = t1; b1.textContent = t1; } b1.classList.remove('hidden'); }
    else b1.classList.add('hidden');
    $('#bRun').classList.toggle('on', !!Input.runToggle);
    if (UI.dirty && UI.panelKind) UI.refreshPanel();
    UI.dirty = false;
  },
  seaButtons() {
    const b0 = $('#bAct'); if (b0.dataset.l !== 'sea') { b0.dataset.l = 'sea'; b0.innerHTML = iconImg('ui_hook', 'bi') + ' Giữ để móc'; b0.classList.remove('dim'); }
  },
  seaHud(S) {
    $('#seaProg span').style.width = U.clamp(S.t / S.dur * 100, 0, 100) + '%';
    $('#seaHp span').style.width = U.clamp(S.hp, 0, 100) + '%';
    $('#seaHp').classList.toggle('warn', S.hp < 30);
    $('#seaInfo').textContent = 'Độ bền ' + Math.max(0, Math.round(S.hp)) + ' · Còn ' + U.fmtTime(S.dur - S.t) + (S.compass ? ' · có la bàn' : '');
    const m = $('#seaMsg');
    if (S.msgT > 0) { if (m.textContent !== S.msg) m.textContent = S.msg; m.classList.remove('hidden'); } else m.classList.add('hidden');
  },
  busyBar(p, x, y) {
    const b = $('#busy');
    if (p == null) { b.style.display = 'none'; return; }
    b.style.display = 'block'; b.style.left = x + 'px'; b.style.top = y + 'px';
    b.firstChild.style.width = (p * 100) + '%';
  },
  screenFx(hurt, panic, sunny) {
    const f0 = $('#screenfx');
    f0.classList.toggle('hurt', hurt); f0.classList.toggle('panic', panic); f0.classList.toggle('sunny', sunny);
  },
  toast(msg, kind) {
    const t = h('div', 'toast ' + (kind || ''), esc(msg));
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 2800);
    setTimeout(() => t.remove(), 3300);
    while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
  },
  floatText(n, id) {
    const f0 = h('div', 'float', '+' + n + ' ' + iconImg(id, 'fi') + ' ' + esc(ITEMS[id].n));
    f0.style.top = (40 + ($('#floats').children.length % 4) * 6) + '%';
    $('#floats').appendChild(f0);
    setTimeout(() => f0.remove(), 1500);
  },
  bubble(text, x, y) {
    const b = $('#bubble');
    if (!text) { b.style.display = 'none'; return; }
    b.style.display = 'block';
    if (b.dataset.t !== text) { b.dataset.t = text; b.textContent = text; }
    b.style.left = x + 'px'; b.style.top = y + 'px';
  },
  fade(mid) {
    const f0 = $('#fade'); f0.classList.add('on');
    setTimeout(() => { mid(); setTimeout(() => f0.classList.remove('on'), 400); }, 700);
  },

  // ---------- Hội thoại ----------
  dialog(lines, cb, cls) {
    lines = (lines || []).filter(l => l && l.text);
    UI.dq.push({ lines, cb, cls, i: 0 });
    if (!UI.dOpen) UI.showDialog();
  },
  showDialog() {
    const d = UI.dq[0];
    if (!d) { UI.dOpen = false; $('#dialog').classList.add('hidden'); return; }
    UI.dOpen = true;
    if (!d.lines.length) { UI.dq.shift(); if (d.cb) d.cb(); UI.showDialog(); return; }
    const l = d.lines[d.i];
    const D0 = $('#dialog');
    D0.className = d.cls || '';
    D0.querySelector('.who').textContent = l.who || '';
    D0.querySelector('.who').style.display = l.who ? '' : 'none';
    D0.querySelector('.txt').textContent = l.text;
    D0.querySelector('.next').textContent = d.i < d.lines.length - 1 ? '▶' : '✔';
  },
  nextLine() {
    const d = UI.dq[0]; if (!d) return;
    d.i++;
    if (d.i >= d.lines.length) {
      UI.dq.shift();
      if (!UI.dq.length) { UI.dOpen = false; $('#dialog').classList.add('hidden'); }
      if (d.cb) d.cb();
      if (UI.dq.length) UI.showDialog();
      return;
    }
    UI.showDialog();
  },
  showPage(p) { UI.dialog([{ who: '📜 Nhật ký của L. — ' + p.t, text: p.x }], null, 'page'); },
  islandCard(D, cb) {
    const c = $('#card');
    c.innerHTML = `<div class="ccard"><div class="cnum">Đảo ${D.n} / 5</div><h1>${esc(D.name)}</h1><div class="crule">Luật đảo — ${esc(D.rule)}</div><p>${esc(D.ruleDesc)}</p>
      ${D.n > 1 ? '<p class="small">Bè hiện tại: ' + RAFT[G.s.raft].part + ' · chứa ' + RAFT[G.s.raft].cap + ' ô</p>' : ''}<button class="big">Lên bờ</button></div>`;
    c.classList.remove('hidden');
    c.querySelector('button').onclick = () => { c.classList.add('hidden'); c.innerHTML = ''; if (cb) cb(); };
  },

  // ---------- Bảng ----------
  openPanel(kind, title) {
    if (!G.s || G.s.phase !== 'island') return;
    if (UI.dOpen) return;
    UI.panelKind = kind;
    $('#panel').classList.remove('hidden');
    $('#panel h2').textContent = title;
    UI.refreshPanel();
  },
  closePanels() { UI.panelKind = null; UI.storeEnt = null; UI.sel = null; $('#panel').classList.add('hidden'); },
  refreshPanel() {
    const b = $('#panel .pbody');
    const k = UI.panelKind;
    if (k === 'inv') UI.renderInv(b);
    else if (k === 'craft') UI.renderCraft(b);
    else if (k === 'store') UI.renderStore(b);
    else if (k === 'journal') UI.renderJournal(b);
    else if (k === 'map') UI.renderMap(b);
    else if (k === 'pack') UI.renderPack(b);
    else if (k === 'menu') UI.renderMenu(b);
  },
  slotHtml(s, i, sel) {
    if (!s) return `<div class="slot empty" data-i="${i}"></div>`;
    return `<div class="slot${sel ? ' sel' : ''}" data-i="${i}" title="${esc(ITEMS[s.id].n)}"><span class="ic">${iconImg(s.id)}</span>${s.n > 1 ? '<span class="n">' + s.n + '</span>' : ''}</div>`;
  },
  openInv() { UI.sel = null; UI.openPanel('inv', '🎒 Túi đồ'); },
  renderInv(b) {
    const inv = G.s.inv;
    let html = '<div class="grid">';
    for (let i = 0; i < G.s.invSize; i++) html += UI.slotHtml(inv[i], i, UI.sel === i);
    html += '</div><div class="detail">';
    const s = UI.sel != null ? inv[UI.sel] : null;
    if (s) {
      const it = ITEMS[s.id];
      let info = '';
      if (it.type === 'food') info = 'Đói +' + (it.f || 0) + (it.w ? ' · Khát +' + it.w : '') + (it.hp ? ' · Sức khỏe +' + it.hp : '') + (it.heat ? ' · Nhiệt ' + it.heat : '');
      if (it.type === 'drink') info = 'Khát +' + it.w;
      if (it.type === 'tool') info = 'Công cụ — tự dùng khi có trong túi';
      if (it.type === 'wear') info = 'Đồ mang — tự có tác dụng khi ở trong túi';
      html += `<div class="dname">${iconImg(s.id, 'di')} ${esc(it.n)} ×${s.n}</div><div class="ddesc">${esc(it.d || '')} ${info ? '<br><em>' + info + '</em>' : ''}</div><div class="row">`;
      const useLabel = { food: 'Ăn', drink: 'Uống' }[it.type] || (s.id === 'torch' || s.id === 'lantern' ? 'Thắp sáng' : s.id === 'cooling_flask' ? 'Làm mát' : null);
      if (useLabel) html += `<button data-a="use">${useLabel}</button>`;
      html += `<button data-a="drop" class="alt">Bỏ 1</button>${s.n > 1 ? '<button data-a="dropall" class="alt">Bỏ hết</button>' : ''}</div>`;
    } else html += '<div class="ddesc">Chạm vào một ô để xem. Túi ' + G.s.invSize + ' ô, nguyên liệu chồng tối đa 10.</div>';
    html += '</div>';
    b.innerHTML = html;
    b.querySelectorAll('.slot').forEach(el => el.onclick = () => { const i = +el.dataset.i; UI.sel = G.s.inv[i] ? i : null; UI.renderInv(b); });
    b.querySelectorAll('button[data-a]').forEach(el => el.onclick = () => {
      const a = el.dataset.a;
      if (a === 'use') G.useSlot(UI.sel);
      if (a === 'drop') G.dropSlot(UI.sel, false);
      if (a === 'dropall') G.dropSlot(UI.sel, true);
      if (!G.s.inv[UI.sel]) UI.sel = null;
      UI.renderInv(b);
    });
  },
  openCraft() { UI.openPanel('craft', '🔨 Chế tạo'); },
  renderCraft(b) {
    const list = G.recipesVisible().map(r => ({ r, c: G.canCraft(r) }));
    list.sort((a, b2) => (b2.c.ok - a.c.ok) || (b2.r.isl - a.r.isl));
    let html = '<div class="clist">';
    for (const { r, c } of list) {
      const needs = c.needs;
      let chips = '';
      for (const k in needs) { const okk = G.has(k, needs[k]); chips += `<span class="chip ${okk ? 'ok' : 'no'}" title="${esc(ITEMS[k].n)}">${iconImg(k, 'ci')} ${G.count(k)}/${needs[k]}</span>`; }
      if (r.anyRope) { const n = G.count('coir_rope') + G.count('hemp_rope'); chips += `<span class="chip ${n >= r.anyRope ? 'ok' : 'no'}">${iconImg('coir_rope', 'ci')} dây ${n}/${r.anyRope}</span>`; }
      if (r.tools) for (const t of r.tools) chips += `<span class="chip ${G.has(t) ? 'ok' : 'no'}">cần ${iconImg(t, 'ci')}</span>`;
      const stn = `<span class="chip st ${c.st ? 'ok' : 'no'}">${STATION_NAME[r.st]}</span>`;
      html += `<div class="crow ${c.ok ? 'can' : ''}"><div class="cic">${iconImg(r.icon)}</div><div class="cmid"><div class="cn">${esc(r.n)}${r.out && Object.values(r.out)[0] > 1 ? ' ×' + Object.values(r.out)[0] : ''}</div>
        ${r.d ? '<div class="cd">' + esc(r.d) + '</div>' : ''}<div class="chips">${chips}${stn}</div></div><button data-id="${r.id}" ${c.ok ? '' : 'class="alt"'}>Chế</button></div>`;
    }
    html += '</div>';
    b.innerHTML = html;
    b.querySelectorAll('button[data-id]').forEach(el => el.onclick = () => G.craft(RECIPES.find(r => r.id === el.dataset.id)));
  },
  openStore(e) { UI.storeEnt = e; if (!e.store) e.store = new Array(20).fill(null); UI.openPanel('store', '📦 Rương (không theo bạn sang đảo khác)'); },
  renderStore(b) {
    const e = UI.storeEnt, inv = G.s.inv;
    let html = '<div class="sub">Túi — chạm để cất vào rương</div><div class="grid">';
    for (let i = 0; i < G.s.invSize; i++) html += UI.slotHtml(inv[i], i).replace('class="slot', 'data-from="inv" class="slot');
    html += '</div><div class="sub">Rương — chạm để lấy ra</div><div class="grid">';
    for (let i = 0; i < 20; i++) html += UI.slotHtml(e.store[i], i).replace('class="slot', 'data-from="st" class="slot');
    html += '</div>';
    b.innerHTML = html;
    b.querySelectorAll('.slot').forEach(el => el.onclick = () => {
      const i = +el.dataset.i;
      if (el.dataset.from === 'inv') {
        const s = inv[i]; if (!s) return;
        let n = s.n; const max = STACK(s.id);
        for (let j = 0; j < 20 && n > 0; j++) { const t = e.store[j]; if (t && t.id === s.id && t.n < max) { const a = Math.min(n, max - t.n); t.n += a; n -= a; } }
        for (let j = 0; j < 20 && n > 0; j++) if (!e.store[j]) { e.store[j] = { id: s.id, n }; n = 0; }
        if (n > 0) { s.n = n; G.toast('Rương đầy!'); } else inv[i] = null;
      } else {
        const s = e.store[i]; if (!s) return;
        const left = G.giveRaw(s.id, s.n);
        if (left > 0) { s.n = left; G.toast('Túi đầy!'); } else e.store[i] = null;
      }
      UI.renderStore(b);
    });
  },
  openJournal(tab) { UI.jTab = tab || UI.jTab || 'q'; UI.openPanel('journal', '📖 Nhật ký'); },
  renderJournal(b) {
    const tabs = [['q', 'Nhiệm vụ'], ['p', 'Trang nhật ký'], ['r', 'Di vật'], ['h', 'Luật đảo']];
    let html = '<div class="tabs">' + tabs.map(t => `<button data-t="${t[0]}" class="${UI.jTab === t[0] ? 'on' : ''}">${t[1]}</button>`).join('') + '</div><div class="jbody">';
    const D = G.ISL, I = G.s.isl;
    if (UI.jTab === 'q') {
      html += '<h3>Nhiệm vụ chính — ' + esc(D.name) + '</h3><ol class="ql">';
      D.main.forEach((q, i) => {
        const st = i < I.q ? 'done' : i === I.q ? 'cur' : 'lock';
        html += `<li class="${st}"><b>${esc(q.t)}</b> — ${i <= I.q ? esc(q.d) + (q.p && i === I.q ? ' <em>(' + esc(Cond.tpl(q.p)) + ')</em>' : '') : '???'}</li>`;
      });
      html += '</ol>';
      if (D.side.length) {
        html += '<h3>Nhiệm vụ phụ</h3><ul class="ql">';
        D.side.forEach(s => html += `<li class="${G.s.side[s.id] ? 'done' : 'cur'}"><b>${esc(s.t)}</b> — ${esc(s.d)}${s.p && !G.s.side[s.id] ? ' <em>(' + esc(Cond.tpl(s.p)) + ')</em>' : ''}</li>`);
        html += '</ul>';
      }
      html += '<h3>Nhiệm vụ nhật ký</h3><p>Tìm trang nhật ký và di vật — chúng quyết định kết thúc của bạn. Đã có ' + Object.keys(G.s.pages).length + '/20 trang.</p>';
    } else if (UI.jTab === 'p') {
      html += '<div class="pages">';
      PAGES.forEach(p => {
        const got = G.s.pages[p.id];
        html += got ? `<div class="pg"><b>Đảo ${p.isl} · ${esc(p.t)}</b><p>${esc(p.x)}</p></div>` : `<div class="pg lock"><b>Đảo ${p.isl} · ???</b><p>Trang này chưa tìm thấy.</p></div>`;
      });
      html += '</div>';
      if (Object.keys(G.s.pages).length >= 20) html += `<div class="letter"><b>Thư gửi Bống</b><p>${esc(LETTER)}</p></div>`;
      else html += '<p class="small">Thư gửi Bống — mở khóa khi có đủ 20 trang.</p>';
    } else if (UI.jTab === 'r') {
      html += '<div class="pages">';
      for (const k in RELICS) { const r = RELICS[k]; html += G.s.relics[k] ? `<div class="pg">${iconImg('relic_' + k, 'pi')}<b>${esc(r.n)}</b><p>${esc(r.d)}</p></div>` : `<div class="pg lock"><b>??? </b><p>Một di vật của Lâm vẫn còn đâu đó.</p></div>`; }
      html += `<div class="pg">${iconImg('raft' + Math.max(1, G.s.raft), 'pi')}<b>Bè của bạn</b><p>${G.s.raft ? RAFT[G.s.raft].part + ' · chứa ' + RAFT[G.s.raft].cap + ' ô · tốc độ x' + RAFT[G.s.raft].speed + ' · chịu sóng cấp ' + RAFT[G.s.raft].wave : 'Chưa có bè.'}${G.s.deco.shells ? '<br>Trang trí: vỏ ốc' : ''}${G.s.deco.stones ? '<br>Trang trí: đá năm màu' : ''}${G.s.deco.flag ? '<br>Trang trí: lá cờ' : ''}</p></div>`;
      html += `<div class="pg">${iconImg('parrot', 'pi')}<b>Mõ</b><p>${G.s.parrot.friend ? 'Vẹt của Lâm. Đi theo bạn, lặp lại lời Lâm từng nói.' : 'Một con vẹt ở trại bỏ hoang trên Đảo Dừa.'}</p></div></div>`;
    } else {
      html += `<h3>Luật đảo — ${esc(D.rule)}</h3><p>${esc(D.ruleDesc)}</p>
        <h3>Chỉ số</h3><p>❤️ Sức khỏe · 🍗 Đói (−1 mỗi 20s) · 💧 Khát (−1 mỗi 12s) · ⚡ Thể lực (chạy, chặt, bơi). Đói hoặc khát về 0 sẽ mất sức khỏe. Ngủ ở lều/chòi vào ban đêm để qua đêm.</p>
        <h3>Điều khiển</h3><p>Di chuyển: cần điều khiển trái / WASD. Tương tác: nút lớn / E hoặc Space. Hành động phụ: nút nhỏ / Q. Chạy: 🏃 / Shift. Chế tạo: C. Túi: I. Nhật ký: J. Bản đồ: M.</p>`;
    }
    html += '</div>';
    b.innerHTML = html;
    b.querySelectorAll('.tabs button').forEach(el => el.onclick = () => { UI.jTab = el.dataset.t; UI.renderJournal(b); });
  },
  openMap() { UI.openPanel('map', '🗺️ Bản đồ' + (G.ISL.fog ? ' (tự vẽ)' : '')); },
  renderMap(b) {
    const m = G.map, I = G.s.isl;
    b.innerHTML = '<canvas id="mapCv"></canvas><div class="small" id="mapLegend"></div>';
    const cv = $('#mapCv');
    const cs = Math.max(4, Math.floor(Math.min((b.clientWidth || 600) - 8, 760) / m.w));
    cv.width = m.w * cs; cv.height = m.h * cs;
    const c = cv.getContext('2d');
    const fog = G.ISL.fog;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (fog && !G.rt.explored[y * m.w + x]) { c.fillStyle = '#c8ccd0'; c.fillRect(x * cs, y * cs, cs, cs); continue; }
      const ti = R.frame(TILES[G.tile(x, y)].img, 0);
      if (ti) c.drawImage(ti.cv, x * cs, y * cs, cs, cs);
    }
    c.font = 'bold ' + Math.max(10, cs * 1.6) + 'px system-ui'; c.textAlign = 'center';
    for (const z of m.zones) {
      if (fog && !G.rt.explored[Math.floor(z.cy) * m.w + Math.floor(z.cx)] && !(z.id === 'hai_dang' && Cond.ok(G.ISL.main[3].done))) continue;
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillText(z.name, z.cx * cs + 1, z.cy * cs + 1); c.fillStyle = '#fff'; c.fillText(z.name, z.cx * cs, z.cy * cs);
    }
    const mark = (x, y, key) => R.spr(c, key, x * cs, y * cs, { scale: Math.max(0.35, cs / 24) });
    for (const e of I.ents) {
      if (fog && !G.rt.explored[Math.floor(e.y) * m.w + Math.floor(e.x)]) continue;
      if (e.k === 'raftsite') mark(e.x, e.y, 'raftsite');
      if (e.k === 'tent' || e.k === 'stilt_hut' || e.k === 'lam_camp') mark(e.x, e.y, e.k === 'lam_camp' ? 'lam_camp' : 'tent');
      if (e.k === 'campfire') mark(e.x, e.y, 'campfire_0');
    }
    const LH = G.ISL.params.lighthouse;
    if (fog && LH && Cond.ok(G.ISL.main[3].done)) mark(LH.x, LH.y, 'lighthouse');
    const ps = G.playerSprite(); R.spr(c, ps.key.replace(/_(down|up|side)$/, '_$1_0'), I.px * cs, I.py * cs, { scale: Math.max(0.5, cs / 16), flip: ps.flip });
    $('#mapLegend').textContent = (fog ? 'Đã khám phá ' + Math.floor(G.explorePct()) + '% đảo. ' : '') + 'Bản đồ hiện vị trí của bạn, bãi đóng bè, trại và đống lửa.';
  },
  openPack(cb) {
    UI.packCb = cb;
    const cap = RAFT[G.s.raft].cap + 4;
    const hint = G.ISL.nextHint || { items: [] };
    // chọn mặc định: ưu tiên món gợi ý, rồi công cụ
    const slots = [];
    for (let i = 0; i < G.s.invSize; i++) if (G.s.inv[i]) slots.push(i);
    const score = i => { const id = G.s.inv[i].id; const k = hint.items.indexOf(id); return (k >= 0 ? 100 - k : 0) + (ITEMS[id].type === 'tool' ? 20 : 0) + (ITEMS[id].type === 'key' ? 50 : 0); };
    slots.sort((a, b2) => score(b2) - score(a));
    UI.pack = new Set(slots.slice(0, cap));
    UI.openPanel('pack', '⛵ Chọn hành trang');
  },
  renderPack(b) {
    const cap = RAFT[G.s.raft].cap + 4, hint = G.ISL.nextHint || { items: [], text: '' };
    let html = `<p>Bè chứa <b>${RAFT[G.s.raft].cap}</b> ô + <b>4</b> ô túi đeo người = <b>${cap}</b> ô. Phần còn lại ở lại đảo. Trang nhật ký và di vật luôn đi cùng bạn.</p>
      <p class="hint">${G.s.parrot.friend ? esc(hint.text) : '💭 Nhật ký Lâm gợi ý: ' + hint.items.slice(0, 3).map(k => ITEMS[k].n).join(', ')}</p>
      <div class="sub">Đã chọn ${UI.pack.size}/${cap}</div><div class="grid">`;
    for (let i = 0; i < G.s.invSize; i++) {
      const s = G.s.inv[i]; if (!s) continue;
      const on = UI.pack.has(i), sug = hint.items.includes(s.id);
      html += UI.slotHtml(s, i, on).replace('class="slot', 'class="slot pk' + (on ? ' on' : '') + (sug ? ' sug' : ''));
    }
    html += '</div><div class="row"><button class="alt" id="pkCancel">Ở lại thêm</button><button id="pkGo">⛵ Ra khơi</button></div>';
    b.innerHTML = html;
    b.querySelectorAll('.slot').forEach(el => el.onclick = () => {
      const i = +el.dataset.i;
      if (UI.pack.has(i)) UI.pack.delete(i); else if (UI.pack.size < cap) UI.pack.add(i); else G.toast('Bè đã đầy ' + cap + ' ô');
      UI.renderPack(b);
    });
    $('#pkCancel').onclick = () => UI.closePanels();
    $('#pkGo').onclick = () => {
      const keep = new Array(20).fill(null); let j = 0;
      for (let i = 0; i < G.s.invSize; i++) if (UI.pack.has(i) && G.s.inv[i]) keep[j++] = G.s.inv[i];
      G.s.inv = keep;
      UI.closePanels();
      const cb = UI.packCb; UI.packCb = null; if (cb) cb();
    };
  },
  openMenu() { UI.openPanel('menu', '⚙️ Tạm dừng'); },
  renderMenu(b) {
    b.innerHTML = `<div class="menu">
      <button id="mSound">${SFX.muted ? iconImg('ui_sound_on', 'bi') + ' Bật âm thanh' : iconImg('ui_sound_off', 'bi') + ' Tắt âm thanh'}</button>
      <button id="mSave">Lưu game</button>
      <button id="mHelp" class="alt">Luật đảo & điều khiển</button>
      <button id="mQuit" class="alt">Lưu & về màn hình chính</button>
      <p class="small">Độ khó: ${G.s.hard ? 'Khó' : 'Thường'} · Đã gục ngã ${G.s.deaths} lần · Game tự lưu mỗi 20 giây.</p>
      <p class="small">Đảo 4 dùng âm thanh làm cơ chế chính — nên đeo tai nghe.</p></div>`;
    $('#mSound').onclick = () => { SFX.setMuted(!SFX.muted); G.setMeta('muted', SFX.muted); UI.renderMenu(b); };
    $('#mSave').onclick = () => { G.save(); G.toast('Đã lưu'); };
    $('#mHelp').onclick = () => { UI.closePanels(); UI.openJournal('h'); };
    $('#mQuit').onclick = () => { G.save(); UI.closePanels(); G.s = null; UI.title(); };
  },
  endCard(key) {
    const E = ENDINGS[key];
    const cv = Story.shareImage(key);
    const url = cv.toDataURL('image/png');
    const c = $('#card');
    c.innerHTML = `<div class="ccard end"><div class="cnum">${esc(E.tag)}</div><h1>${esc(E.n)}</h1><img src="${url}" alt="Ảnh chia sẻ">
      <div class="row"><button id="eDl">⬇ Tải ảnh</button>${navigator.share ? '<button id="eSh">↗ Chia sẻ</button>' : ''}<button class="alt" id="eHome">Màn hình chính</button></div></div>`;
    c.classList.remove('hidden');
    $('#eDl').onclick = () => { const a = document.createElement('a'); a.href = url; a.download = 'nguoi-di-truoc.png'; a.click(); };
    if ($('#eSh')) $('#eSh').onclick = async () => {
      try {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], 'nguoi-di-truoc.png', { type: 'image/png' });
        const data = { title: 'Người Đi Trước', text: 'Mình đạt kết thúc "' + E.n + '" sau ' + G.day() + ' ngày sống sót!' };
        if (navigator.canShare && navigator.canShare({ files: [file] })) data.files = [file];
        await navigator.share(data);
      } catch (e) { }
    };
    $('#eHome').onclick = () => { c.classList.add('hidden'); G.s = null; UI.title(); };
  },
};
