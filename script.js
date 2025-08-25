// Data model for default categories and items
const defaultCategories = [
  {
    id: "work",
    title: "お仕事",
    items: [
      { id: "bo-e", label: "バックオフィス業務E", type: "check" },
      { id: "bo-a", label: "バックオフィス業務A", type: "check" },
    ],
  },
  {
    id: "courses",
    title: "講座受講",
    items: [
      { id: "canva", label: "Canvaプロ養成講座", type: "check" },
      { id: "natsu", label: "プロフリ夏講座", type: "check" },
    ],
  },
  {
    id: "social",
    title: "発信活動",
    items: [
      { id: "x-posts", label: "X投稿", type: "count", suffix: "ポスト" },
      { id: "note", label: "note投稿", type: "check" },
    ],
  },
  {
    id: "study",
    title: "勉強",
    items: [
      { id: "license", label: "資格勉強", type: "check" },
      { id: "duo", label: "Duolingo", type: "streak" },
    ],
  },
  {
    id: "exercise",
    title: "運動",
    items: [
      { id: "radio", label: "ラジオ体操", type: "check" },
      { id: "catpose", label: "猫のポーズ", type: "check" },
      { id: "aerobike", label: "エアロバイク", type: "check" },
    ],
  },
  {
    id: "house",
    title: "家事・育児",
    items: [
      { id: "housework", label: "家事", type: "check" },
    ],
  },
];

// In-memory state (per session only)
let categories = JSON.parse(JSON.stringify(defaultCategories));

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function setToday() {
  const input = document.getElementById('report-date');
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  input.value = ymd;
}

function renderCategories() {
  const root = document.getElementById('categories');
  root.innerHTML = '';

  categories.forEach((cat, catIndex) => {
    const card = document.createElement('section');
    card.className = 'category card';

    const header = document.createElement('div');
    header.className = 'category-header';

    const title = document.createElement('div');
    title.className = 'category-title';
    title.textContent = cat.title || cat.id || 'Unnamed Category';

    const headline = document.createElement('div');
    headline.className = 'category-headline';
    headline.append(title);

    header.append(headline);
    card.appendChild(header);

    const items = document.createElement('div');
    items.className = 'items';

    cat.items.forEach((item, itemIndex) => {
      const row = document.createElement('div');
      row.className = 'item-row';

      const check = document.createElement('input');
      check.type = 'checkbox';
      check.id = `${cat.id}-${item.id}`;

      const label = document.createElement('label');
      label.htmlFor = check.id;
      label.textContent = item.label;

      let extra = document.createElement('div');
      extra.className = 'extra';

      if (item.type === 'count') {
        const num = document.createElement('input');
        num.type = 'number';
        num.min = '0';
        num.placeholder = '本数';
        num.dataset.kind = 'count';
        num.dataset.itemId = check.id;
        extra.appendChild(num);
      } else if (item.type === 'streak') {
        const num = document.createElement('input');
        num.type = 'number';
        num.min = '1';
        num.placeholder = '連続日数';
        num.dataset.kind = 'streak';
        num.dataset.itemId = check.id;
        extra.appendChild(num);
      }

      const remove = document.createElement('button');
      remove.className = 'remove secondary';
      remove.textContent = '削除';
      remove.title = 'この項目を削除';
      remove.addEventListener('click', () => {
        categories[catIndex].items.splice(itemIndex, 1);
        renderCategories();
      });

      row.append(check, label, extra, remove);
      items.appendChild(row);
    });

    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'チェックした項目のみが日報に入ります。X投稿は本数、Duolingoは連続日数を入力してください。';

    card.append(items, hint);
    root.appendChild(card);
  });
}

function generateReport() {
  const dateStr = $('#report-date').value;
  const one = $('#one-liner').value.trim();

  const lines = [];
  if (dateStr) {
    const d = new Date(dateStr.replaceAll('-', '/'));
    const wk = ['日','月','火','水','木','金','土'];
    const m = d.getMonth() + 1;
    const da = d.getDate();
    const w = wk[d.getDay()];
    lines.push(`${m}月${da}日（${w}）`);
  }

  categories.forEach((cat) => {
    const section = [];
    // Find inputs inside this category card by matching id prefix
    cat.items.forEach((item) => {
      const id = `${cat.id}-${item.id}`;
      const checked = document.getElementById(id)?.checked;
      if (!checked) return;

      if (item.type === 'check') {
        section.push(`◯${item.label}`);
      } else if (item.type === 'count') {
        const num = $(`input[data-item-id="${id}"]`);
        const n = num && num.value !== '' ? Number(num.value) : null;
        const suffix = item.suffix || '';
        const countText = n != null ? `${n}${suffix}` : '';
        // X投稿だけは「X投稿3ポスト」のように後ろに数
        if (item.label === 'X投稿') {
          section.push(`◯X投稿${n != null ? n : ''}ポスト`);
        } else {
          section.push(`◯${item.label}${countText ? countText : ''}`);
        }
      } else if (item.type === 'streak') {
        const num = $(`input[data-item-id="${id}"]`);
        const n = num && num.value !== '' ? Number(num.value) : null;
        section.push(`◯${item.label}${n != null ? `（${n}日目）` : ''}`);
      }
    });

    if (section.length) {
      lines.push('');
      const icon = categoryIcons[cat.id] || '🗂️';
      lines.push(`${icon} ${cat.title}`);
      lines.push(...section);
    }
  });

  if (one) {
    lines.push('');
    lines.push(`今日の一言：${one}`);
  }
  lines.push('');
  lines.push('今日もお疲れ様でした🍻');

  $('#output').value = lines.join('\n');
}

function copyOutput() {
  const out = $('#output');
  out.select();
  out.setSelectionRange(0, out.value.length);
  try {
    const ok = document.execCommand('copy');
    if (!ok) throw new Error('copy failed');
  } catch (e) {
    // Fallback to Clipboard API if available
    if (navigator.clipboard) {
      navigator.clipboard.writeText(out.value).catch(() => {});
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setToday();
  document.getElementById('generate').addEventListener('click', generateReport);
  document.getElementById('copy').addEventListener('click', copyOutput);
});

// --- config loader integration ---
// This will be called by config-loader.js after config is ready
function bootstrap(config) {
  if (!config || !Array.isArray(config.categories)) {
    console.warn('bootstrap called with invalid config, using defaults');
    return;
  }

  // Map config format to the one used by this script
  const mapped = config.categories.map(c => ({
    id: c.id,
    title: c.name,
    items: (c.items || []).map(it => ({
      id: it.id,
      label: it.name,
      type: it.type || 'check', // Use type from config, fallback to 'check'
      suffix: it.suffix || '',   // Pass through suffix
    })),
  }));

  // Overwrite default categories
  categories = mapped;

  // Re-render
  renderCategories();
}

// Also listen for event, just in case
window.addEventListener('nippou:config-ready', (e) => {
  bootstrap(e.detail);
});