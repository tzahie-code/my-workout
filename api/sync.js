export const config = { runtime: 'edge' };

export default async function handler(req) {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Content-Type': 'application/json'
  };
  const ok  = (body)        => new Response(JSON.stringify(body), { headers: CORS });
  const err = (msg, status) => new Response(JSON.stringify({ error: msg }), { status, headers: CORS });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  // ── Turso helper ──────────────────────────────────────────
  const dbUrl   = (process.env.TURSO_URL || '').replace('libsql://', 'https://');
  const dbToken = process.env.TURSO_TOKEN || '';

  async function tursoExec(sql, args = []) {
    const r = await fetch(`${dbUrl}/v2/pipeline`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${dbToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ type: 'execute', stmt: { sql, args } }, { type: 'close' }]
      })
    });
    return r.json();
  }

  // Ensure table exists (idempotent)
  await tursoExec(`CREATE TABLE IF NOT EXISTS user_data (
    user_id    TEXT PRIMARY KEY,
    email      TEXT,
    data       TEXT NOT NULL DEFAULT '{}',
    updated_at INTEGER NOT NULL DEFAULT 0
  )`);

  // ── Verify token (Google JWT or email/password session) ──
  const auth    = req.headers.get('authorization') || '';
  const idToken = auth.replace('Bearer ', '').trim();
  if (!idToken) return err('No token', 401);

  let userId, email;

  if (idToken.split('.').length === 3) {
    // Google ID token (JWT)
    const gRes  = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    const gUser = await gRes.json();
    if (!gRes.ok || !gUser.sub) return err('Invalid token', 401);
    userId = gUser.sub;
    email  = gUser.email || '';
  } else {
    // Email/password session token
    const sResult = await tursoExec(
      'SELECT user_id FROM mw_sessions WHERE token = ? AND expires_at > ?',
      [{ type:'text', value: idToken }, { type:'integer', value: String(Date.now()) }]
    );
    const sRows = sResult.results?.[0]?.response?.result?.rows;
    if (!sRows?.length) return err('Invalid or expired session', 401);
    userId = sRows[0][0].value;
    // Get email from users table
    const uResult = await tursoExec(
      'SELECT email FROM mw_users WHERE user_id = ?',
      [{ type:'text', value: userId }]
    );
    const uRows = uResult.results?.[0]?.response?.result?.rows;
    email = uRows?.[0]?.[0]?.value || '';
  }

  // ── GET — load user data ──────────────────────────────────
  if (req.method === 'GET') {
    const result = await tursoExec(
      'SELECT data FROM user_data WHERE user_id = ?',
      [{ type: 'text', value: userId }]
    );
    const rows = result.results?.[0]?.response?.result?.rows;
    if (rows?.length) {
      return ok({ data: JSON.parse(rows[0][0].value), email });
    }
    return ok({ data: null, email });
  }

  // ── POST — save user data ─────────────────────────────────
  if (req.method === 'POST') {
    const body    = await req.json();
    const dataStr = JSON.stringify(body.data || {});
    await tursoExec(
      `INSERT INTO user_data (user_id, email, data, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         data       = excluded.data,
         email      = excluded.email,
         updated_at = excluded.updated_at`,
      [
        { type: 'text',    value: userId   },
        { type: 'text',    value: email    },
        { type: 'text',    value: dataStr  },
        { type: 'integer', value: String(Date.now()) }
      ]
    );
    return ok({ ok: true });
  }

  return err('Method not allowed', 405);
}
