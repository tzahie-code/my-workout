export const config = { runtime: 'edge' };

// Proxies exercise GIF images so the PDF exporter can draw them onto a canvas.
// fitnessprogramer.com doesn't serve CORS headers, so canvas.toDataURL() would
// throw a SecurityError if we fetched images directly.
export default async function handler(req) {
  const CORS = { 'Access-Control-Allow-Origin': '*' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url).searchParams.get('url');
  if (!url) return new Response('Missing url', { status: 400, headers: CORS });

  let parsed;
  try { parsed = new URL(url); } catch { return new Response('Invalid url', { status: 400, headers: CORS }); }

  // Restrict to known image host — prevents open-proxy abuse
  if (!parsed.hostname.endsWith('fitnessprogramer.com')) {
    return new Response('Forbidden', { status: 403, headers: CORS });
  }

  const upstream = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  }).catch(() => null);

  if (!upstream?.ok) return new Response('Image unavailable', { status: 502, headers: CORS });

  const contentType = upstream.headers.get('content-type') || 'image/gif';
  const body = await upstream.arrayBuffer();

  return new Response(body, {
    headers: {
      ...CORS,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    }
  });
}
