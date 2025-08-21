import { list, put } from '@vercel/blob';
import { DEFAULTS } from '../defaults.js';

const BLOB_KEY = 'nippou-config.json';

/**
 * GET  /api/config
 * - Returns saved config from Vercel Blob if exists
 * - Otherwise returns defaults.json bundled with the app
 */
export default async function handler(req, res) {
  // Allow only GET/POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (req.method === 'GET') {
    // Try Blob first; on any error, fall back to in-bundled defaults
    try {
      try {
        const { blobs } = await list({ prefix: BLOB_KEY });
        if (blobs && blobs.length > 0) {
          const url = blobs[0].url;
          const r = await fetch(url);
          if (r.ok) {
            const data = await r.json();
            return res.status(200).json({ source: 'blob', config: data });
          }
        }
      } catch (_) {
        // ignore blob errors and fall back
      }

      // Fallback to bundled defaults
      return res.status(200).json({ source: 'defaults', config: DEFAULTS });
    } catch (e) {
      console.error(e);
      return res.status(200).json({ source: 'defaults', config: DEFAULTS });
    }
  }

  // POST: save config (admin only)
  try {
    const auth = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken || token !== adminToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');

    if (body && body.reset === true) {
      // Reset to defaults by overwriting blob with defaults
      const text = await fs.readFile(process.cwd() + '/defaults.json', 'utf-8');
      await put(BLOB_KEY, text, {
        access: 'public',
        contentType: 'application/json',
      });
      return res.status(200).json({ ok: true, reset: true });
    }

    // Basic validation
    if (!body || typeof body !== 'object' || !Array.isArray(body.categories)) {
      return res.status(400).json({ error: 'Invalid config: missing categories[]' });
    }

    const payload = JSON.stringify({ version: body.version || 1, categories: body.categories }, null, 2);

    await put(BLOB_KEY, payload, {
      access: 'public',
      contentType: 'application/json',
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to save config' });
  }
}
