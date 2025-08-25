// Lightweight config loader for nippou generator
// - Fetches /api/config and falls back to /defaults.json
// - Exposes result as window.NIPPOU_CONFIG
// - Tries to call common initializers: init(config) or bootstrap(config)
// - Also emits a CustomEvent 'nippou:config-ready' with detail = config

(async () => {
  try {
    const cfg = await (async () => {
      try {
        const r = await fetch('/api/config', { cache: 'no-store' });
        if (!r.ok) throw new Error('api/config ' + r.status);
        const data = await r.json();
        console.log('[config-loader] Loaded config from /api/config');
        return data.config || data;
      } catch (e) {
        console.error('[config-loader] Failed to load from /api/config, falling back to defaults:', e);
        const r2 = await fetch('/defaults.json', { cache: 'no-store' });
        if (!r2.ok) throw new Error('defaults.json ' + r2.status);
        console.log('[config-loader] Loaded config from /defaults.json');
        return await r2.json();
      }
    })();

    // Sort by order if provided
    const categories = Array.isArray(cfg.categories) ? [...cfg.categories] : [];
    categories.sort((a, b) => (a.order || 0) - (b.order || 0));
    for (const c of categories) {
      if (Array.isArray(c.items)) c.items.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    const normalized = { ...cfg, categories };

    // Expose globally
    window.NIPPOU_CONFIG = normalized;

    // Fire event for listeners
    try {
      window.dispatchEvent(new CustomEvent('nippou:config-ready', { detail: normalized }));
    } catch {}

    // Try common init names
    const cand = [
      window.init,
      window.bootstrap,
      window.start,
    ].filter(Boolean);
    if (cand.length) {
      try { cand[0](normalized); } catch {}
    }
  } catch (e) {
    console.error('[config-loader] failed to load config', e);
  }
})();
