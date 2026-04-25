export const config = { runtime: 'edge' };

// ── helpers ──────────────────────────────────────────────────
function randHex(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function hashPwd(salt, password) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name:'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name:'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash:'SHA-256' },
    key, 256
  );
  return Array.from(new Uint8Array(bits)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function tursoExec(dbUrl, dbToken, sql, args = []) {
  const r = await fetch(`${dbUrl}/v2/pipeline`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${dbToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ type:'execute', stmt:{ sql, args } }, { type:'close' }] })
  });
  return r.json();
}

function rows(result) {
  return result.results?.[0]?.response?.result?.rows || [];
}

// ── handler ──────────────────────────────────────────────────
export default async function handler(req) {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  const ok  = b  => new Response(JSON.stringify(b), { headers: CORS });
  const err = (m, s) => new Response(JSON.stringify({ error: m }), { status: s, headers: CORS });

  if (req.method === 'OPTIONS') return new Response(null, { status:204, headers: CORS });
  if (req.method !== 'POST')    return err('Method not allowed', 405);

  const dbUrl   = (process.env.TURSO_URL || '').replace('libsql://', 'https://');
  const dbToken = process.env.TURSO_TOKEN || '';
  const db      = (sql, args) => tursoExec(dbUrl, dbToken, sql, args);

  // Ensure tables exist
  await db(`CREATE TABLE IF NOT EXISTS mw_users (
    user_id    TEXT PRIMARY KEY,
    email      TEXT UNIQUE NOT NULL,
    pass_hash  TEXT NOT NULL,
    salt       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);
  await db(`CREATE TABLE IF NOT EXISTS mw_sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )`);

  const { action, email, password } = await req.json();
  if (!action || !email || !password) return err('Missing fields', 400);
  const cleanEmail = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return err('Invalid email', 400);
  if (password.length < 6) return err('Password must be at least 6 characters', 400);

  // ── REGISTER ─────────────────────────────────────────────
  if (action === 'register') {
    const existing = rows(await db(
      'SELECT user_id FROM mw_users WHERE email = ?',
      [{ type:'text', value: cleanEmail }]
    ));
    if (existing.length) return err('Email already registered', 409);

    const userId   = 'ep-' + randHex(16);
    const salt     = randHex(32);
    const passHash = await hashPwd(salt, password);

    await db(
      'INSERT INTO mw_users (user_id, email, pass_hash, salt, created_at) VALUES (?,?,?,?,?)',
      [
        { type:'text',    value: userId    },
        { type:'text',    value: cleanEmail},
        { type:'text',    value: passHash  },
        { type:'text',    value: salt      },
        { type:'integer', value: String(Date.now()) }
      ]
    );

    const token     = randHex(32);
    const expiresAt = Date.now() + 30*24*60*60*1000;
    await db(
      'INSERT INTO mw_sessions (token, user_id, expires_at) VALUES (?,?,?)',
      [{ type:'text', value:token }, { type:'text', value:userId }, { type:'integer', value:String(expiresAt) }]
    );

    return ok({ token, userId, email: cleanEmail });
  }

  // ── LOGIN ────────────────────────────────────────────────
  if (action === 'login') {
    const userRows = rows(await db(
      'SELECT user_id, pass_hash, salt FROM mw_users WHERE email = ?',
      [{ type:'text', value: cleanEmail }]
    ));
    if (!userRows.length) return err('Invalid email or password', 401);

    const userId   = userRows[0][0].value;
    const passHash = userRows[0][1].value;
    const salt     = userRows[0][2].value;

    const inputHash = await hashPwd(salt, password);
    if (inputHash !== passHash) return err('Invalid email or password', 401);

    const token     = randHex(32);
    const expiresAt = Date.now() + 30*24*60*60*1000;
    await db(
      'INSERT INTO mw_sessions (token, user_id, expires_at) VALUES (?,?,?)',
      [{ type:'text', value:token }, { type:'text', value:userId }, { type:'integer', value:String(expiresAt) }]
    );

    return ok({ token, userId, email: cleanEmail });
  }

  return err('Invalid action', 400);
}
