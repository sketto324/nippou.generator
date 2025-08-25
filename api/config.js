import { list, put, del } from '@vercel/blob';
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
    const debugInfo = {
      timestamp: new Date().toISOString(),
      blobListResult: null,
      blobListError: null,
      fetchedUrl: null,
      fetchResponseOk: null,
      fetchResponseStatus: null,
      fetchError: null,
      finalSource: 'defaults', // Assume defaults initially
      config: DEFAULTS,
      internalError: null, // To catch the silent error
    };

    try {
      const { blobs } = await list({ prefix: BLOB_KEY });
      debugInfo.blobListResult = blobs;

      if (blobs && blobs.length > 0) {
        const url = blobs[0].url;
        debugInfo.fetchedUrl = url;
        const r = await fetch(url, { cache: 'no-store' });
        debugInfo.fetchResponseOk = r.ok;
        debugInfo.fetchResponseStatus = r.status;
        if (r.ok) {
          const data = await r.json();
          debugInfo.finalSource = 'blob';
          debugInfo.config = data;
        }
      }
    } catch (e) {
      // This is the critical part - we capture the silent error here
      debugInfo.internalError = {
        message: e.message,
        stack: e.stack,
      };
    }
    
    return res.status(200).json(debugInfo);
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
      // Reset to defaults by deleting the blob.
      // The GET handler will fall back to defaults if the blob doesn't exist.
      await del(BLOB_KEY);
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
