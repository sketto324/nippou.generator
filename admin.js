const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const status = (t, isError = false) => {
  const el = $('#status');
  el.textContent = t;
  el.style.color = isError ? '#c62828' : '#333';
};

let current = null; // working config

// ----- helpers -----
const slug = (s) =>
  (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .slice(0, 32) || 'x';

const uniqId = (base, exists) => {
  let id = slug(base);
  let i = 1;
  while (exists.has(id)) {
    id = `${slug(base)}-${i++}`;
  }
  return id;
};

const recomputeOrder = (cfg) => {
  cfg.categories.forEach((c, i) => {
    c.order = i + 1;
    (c.items || []).forEach((it, j) => (it.order = j + 1));
  });
};

const deepClone = (o) => JSON.parse(JSON.stringify(o || {}));

// ----- data load/save -----
async function loadConfig() {
  status('読み込み中…');
  try {
    const r = await fetch('/api/config', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    current = deepClone(data.config);
    $('#editor').value = JSON.stringify(current, null, 2);
    renderVisual();
    status(`読み込み完了（${data.source}）`);
  } catch (e) {
    console.error(e);
    status('読み込みに失敗 → 初期データに切替', true);
    await loadDefaults();
  }
}

async function loadDefaults() {
  status('初期データを読み込み…');
  try {
    const r = await fetch('/defaults.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    current = deepClone(data);
    $('#editor').value = JSON.stringify(current, null, 2);
    renderVisual();
    status('初期データを読み込みました');
  } catch (e) {
    console.error(e);
    status('初期データの読み込みに失敗', true);
  }
}

async function saveConfig(reset = false) {
  const token = $('#token').value.trim();
  if (!token) {
    status('管理パスワードを入力してください', true);
    return;
  }

  try {
    let payload;
    if (reset) {
      payload = { reset: true };
    } else {
      // pull latest from UI → editor → payload
      const fromUI = collectFromVisual();
      recomputeOrder(fromUI);
      current = deepClone(fromUI);
      $('#editor').value = JSON.stringify(current, null, 2);
      payload = deepClone(current);
    }
    status('保存中…');
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    status(reset ? '初期化して保存しました' : '保存しました');
  } catch (e) {
    console.error(e);
    status('保存に失敗しました: ' + e.message, true);
  }
}

// ----- visual editor -----
function renderVisual() {
  const root = $('#cats');
  if (!root) return;
  root.innerHTML = '';
  const cfg = current || { version: 1, categories: [] };
  const cats = Array.isArray(cfg.categories) ? cfg.categories : [];
  cats.forEach((cat, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'cat';
      wrap.dataset.index = idx;
      wrap.setAttribute('draggable', 'true');

      // DnD: categories
      wrap.addEventListener('dragstart', (e) => {
        try { e.dataTransfer.effectAllowed = 'move'; } catch {}
        try { e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'cat', from: idx })); } catch {}
        wrap.classList.add('dragging');
      });
      wrap.addEventListener('dragend', () => wrap.classList.remove('dragging'));
      wrap.addEventListener('dragover', (e) => {
        e.preventDefault();
        wrap.classList.add('drop-target');
        try { e.dataTransfer.dropEffect = 'move'; } catch {}
      });
      wrap.addEventListener('dragleave', () => wrap.classList.remove('drop-target'));
      wrap.addEventListener('drop', (e) => {
        e.preventDefault();
        wrap.classList.remove('drop-target');
        let data;
        try { data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}'); } catch { data = {}; }
        if (data.type === 'cat') {
          const from = data.from;
          const to = idx;
          if (from === to || from == null || to == null) return;
          moveInArray(current.categories, from, to);
          renderVisual();
        }
      });

      const header = document.createElement('div');
      header.className = 'cat-header';
      const name = document.createElement('input');
      name.type = 'text';
      name.placeholder = 'カテゴリ名';
      name.value = cat.name || '';
      name.addEventListener('input', () => (cat.name = name.value));

      const up = btn('▲', () => moveCategory(idx, -1));
      const down = btn('▼', () => moveCategory(idx, +1));
      const del = btn('削除', () => deleteCategory(idx), 'danger');

      header.append(name, up, down, del);
      wrap.append(header);

      const items = document.createElement('div');
      items.className = 'items';

      (cat.items || []).forEach((it, jdx) => {
          const row = document.createElement('div');
          row.className = 'item';
          row.dataset.index = jdx;
          row.setAttribute('draggable', 'true');

          // DnD: items (within and across categories)
          row.addEventListener('dragstart', (e) => {
            try { e.dataTransfer.effectAllowed = 'move'; } catch {}
            try {
              e.dataTransfer.setData(
                'text/plain',
                JSON.stringify({ type: 'item', fromCat: idx, fromIdx: jdx })
              );
            } catch {}
            row.classList.add('dragging');
          });
          row.addEventListener('dragend', () => row.classList.remove('dragging'));
          row.addEventListener('dragover', (e) => {
            e.preventDefault();
            row.classList.add('drop-target');
            try { e.dataTransfer.dropEffect = 'move'; } catch {}
          });
          row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
          row.addEventListener('drop', (e) => {
            e.preventDefault();
            row.classList.remove('drop-target');
            let data;
            try { data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}'); } catch { data = {}; }
            if (data.type === 'item') {
              const { fromCat, fromIdx } = data;
              const toCat = idx;
              const toIdx = jdx; // insert before target row
              moveItemAcross(fromCat, fromIdx, toCat, toIdx);
              renderVisual();
            }
          });

          const iname = document.createElement('input');
          iname.type = 'text';
          iname.placeholder = '項目名';
          iname.value = it.name || '';
          iname.addEventListener('input', () => (it.name = iname.value));

          const iup = btn('▲', () => moveItem(idx, jdx, -1));
          const idown = btn('▼', () => moveItem(idx, jdx, +1));
          const idel = btn('削除', () => deleteItem(idx, jdx), 'danger');

          row.append(iname, iup, idown, idel);
          items.append(row);
        });

      const addItem = btn('＋ 項目追加', () => addItemToCategory(idx));
      addItem.classList.add('ghost');
      
      // Allow drop to category items container (append at end)
      items.addEventListener('dragover', (e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch {}; items.classList.add('drop-target'); });
      items.addEventListener('dragleave', () => items.classList.remove('drop-target'));
      items.addEventListener('drop', (e) => {
        e.preventDefault();
        items.classList.remove('drop-target');
        let data;
        try { data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}'); } catch { data = {}; }
        if (data.type === 'item') {
          const { fromCat, fromIdx } = data;
          const toCat = idx;
          const toIdx = (current.categories[toCat].items || []).length; // append
          moveItemAcross(fromCat, fromIdx, toCat, toIdx);
          renderVisual();
        }
      });

      items.append(addItem);

      wrap.append(items);
      root.append(wrap);
    });

  // Allow dropping a category at end of list
  root.addEventListener('dragover', (e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch {}; });
  root.addEventListener('drop', (e) => {
    e.preventDefault();
    let data;
    try { data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}'); } catch { data = {}; }
    if (data.type === 'cat') {
      const from = data.from;
      const to = current.categories.length - 1;
      if (from == null) return;
      moveInArray(current.categories, from, to);
      renderVisual();
    }
  });
}

function btn(label, onClick, cls) {
  const b = document.createElement('button');
  b.textContent = label;
  if (cls) b.classList.add(cls);
  b.addEventListener('click', onClick);
  return b;
}

function moveCategory(i, delta) {
  const arr = current.categories || (current.categories = []);
  const j = i + delta;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  renderVisual();
}

function deleteCategory(i) {
  (current.categories || (current.categories = [])).splice(i, 1);
  renderVisual();
}

function addCategory() {
  current.categories || (current.categories = []);
  const exists = new Set(current.categories.map((c) => c.id));
  const name = prompt('新しいカテゴリ名は？', '新しいカテゴリ');
  if (!name) return;
  const id = uniqId(name, exists);
  current.categories.push({ id, name, order: (current.categories.length || 0) + 1, items: [] });
  renderVisual();
}

function moveItem(ci, ii, delta) {
  const arr = current.categories[ci].items || (current.categories[ci].items = []);
  const j = ii + delta;
  if (j < 0 || j >= arr.length) return;
  [arr[ii], arr[j]] = [arr[j], arr[ii]];
  renderVisual();
}

function deleteItem(ci, ii) {
  const arr = current.categories[ci].items || (current.categories[ci].items = []);
  arr.splice(ii, 1);
  renderVisual();
}

function addItemToCategory(ci) {
  const cat = current.categories[ci];
  const exists = new Set((cat.items || []).map((it) => it.id));
  const name = prompt('新しい項目名は？', '新しい項目');
  if (!name) return;
  const id = uniqId(name, exists);
  (cat.items || (cat.items = [])).push({ id, name, order: (cat.items?.length || 0) + 1 });
  renderVisual();
}

function collectFromVisual() {
  // current already reflects in-place edits + move operations.
  const cfg = deepClone(current || { version: 1, categories: [] });
  // ensure ids are present
  const seenCat = new Set();
  cfg.categories.forEach((c) => {
    if (!c.id) c.id = uniqId(c.name || 'cat', seenCat);
    seenCat.add(c.id);
    const seenItem = new Set();
    (c.items || []).forEach((it) => {
      if (!it.id) it.id = uniqId(it.name || 'item', seenItem);
      seenItem.add(it.id);
    });
  });
  return cfg;
}

function moveInArray(arr, from, to) {
  if (from === to) return;
  const [v] = arr.splice(from, 1);
  arr.splice(to, 0, v);
}

function moveItemAcross(fromCat, fromIdx, toCat, toIdx) {
  const fromArr = current.categories[fromCat].items || (current.categories[fromCat].items = []);
  const [v] = fromArr.splice(fromIdx, 1);
  const toArr = current.categories[toCat].items || (current.categories[toCat].items = []);
  if (toIdx > toArr.length) toIdx = toArr.length;
  toArr.splice(toIdx, 0, v);
}

// ----- events -----
$('#btnLoad').addEventListener('click', loadConfig);
$('#btnDefaults').addEventListener('click', loadDefaults);
$('#btnPretty').addEventListener('click', () => {
  try {
    const text = $('#editor').value;
    const obj = JSON.parse(text);
    $('#editor').value = JSON.stringify(obj, null, 2);
    status('整形しました');
  } catch (e) {
    status('JSONが不正です', true);
  }
});
$('#btnSave').addEventListener('click', () => saveConfig(false));
$('#btnReset').addEventListener('click', () => saveConfig(true));
$('#btnAddCategory').addEventListener('click', addCategory);

// tabs
$$('.tab').forEach((t) =>
  t.addEventListener('click', () => {
    $$('.tab').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    const tab = t.dataset.tab;
    $$('.panel').forEach((p) => p.classList.remove('active'));
    $('#panel-' + tab).classList.add('active');
  })
);

// 初回ロード
loadConfig();
