const $ = (s) => document.querySelector(s);
const status = (t, isError = false) => {
  const el = $('#status');
  el.textContent = t;
  el.style.color = isError ? '#c62828' : '#333';
};

async function loadConfig() {
  status('読み込み中…');
  try {
    const r = await fetch('/api/config');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    $('#editor').value = JSON.stringify(data.config, null, 2);
    status(`読み込み完了（${data.source}）`);
  } catch (e) {
    console.error(e);
    status('読み込みに失敗しました', true);
  }
}

async function loadDefaults() {
  status('初期データを読み込み…');
  try {
    const r = await fetch('/defaults.json');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    $('#editor').value = JSON.stringify(data, null, 2);
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
      const text = $('#editor').value;
      payload = JSON.parse(text);
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

// 初回ロード
loadConfig();

