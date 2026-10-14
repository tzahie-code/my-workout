export const config = { runtime: 'edge' };

const UNWANTED_EMAIL = 'tzahi@nucleix.com';
const WANTED_EMAIL = 'elimelech.tzahi@gmail.com';

export default async function handler(req) {
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const dbUrl = (process.env.TURSO_URL || '').replace('libsql://', 'https://');
  const dbToken = process.env.TURSO_TOKEN || '';
  if (!dbUrl || !dbToken) return json({ error: 'Database unavailable' }, 503);

  async function execute(sql, args = []) {
    const response = await fetch(`${dbUrl}/v2/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${dbToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql, args } }, { type: 'close' }] })
    });
    const payload = await response.json();
    if (!response.ok || payload.results?.[0]?.type === 'error') {
      throw new Error(payload.results?.[0]?.error?.message || `Database request failed (${response.status})`);
    }
    return payload.results?.[0]?.response?.result;
  }

  const textArg = value => ({ type: 'text', value });
  const scalar = result => Number(result?.rows?.[0]?.[0]?.value || 0);

  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim();
    if (!token) return json({ error: 'Unauthorized' }, 401);
    let authenticatedEmail = '';
    if (token.startsWith('ya29.')) {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const user = await response.json();
      if (response.ok && user.sub) authenticatedEmail = user.email || '';
    } else if (token.split('.').length === 3) {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
      const user = await response.json();
      if (response.ok && user.sub) authenticatedEmail = user.email || '';
    } else {
      const result = await execute(
        'SELECT email FROM mw_sessions WHERE token = ? AND expires_at > ?',
        [textArg(token), { type: 'integer', value: String(Date.now()) }]
      );
      authenticatedEmail = result?.rows?.[0]?.[0]?.value || '';
    }
    if (authenticatedEmail.toLowerCase() !== WANTED_EMAIL) return json({ error: 'Forbidden' }, 403);

    const userRows = await execute('SELECT user_id FROM mw_users WHERE lower(email) = lower(?)', [textArg(UNWANTED_EMAIL)]);
    const sessionRows = await execute('SELECT DISTINCT user_id FROM mw_sessions WHERE lower(email) = lower(?)', [textArg(UNWANTED_EMAIL)]);
    const dataRows = await execute('SELECT user_id FROM user_data WHERE lower(email) = lower(?)', [textArg(UNWANTED_EMAIL)]);
    const unwantedIds = [...new Set([
      ...(userRows?.rows || []).map(row => row[0].value),
      ...(sessionRows?.rows || []).map(row => row[0].value),
      ...(dataRows?.rows || []).map(row => row[0].value)
    ])];

    const wanted = {
      loginRecords: scalar(await execute('SELECT count(*) FROM mw_users WHERE lower(email) = lower(?)', [textArg(WANTED_EMAIL)])),
      sessions: scalar(await execute('SELECT count(*) FROM mw_sessions WHERE lower(email) = lower(?)', [textArg(WANTED_EMAIL)])),
      workoutRecords: scalar(await execute('SELECT count(*) FROM user_data WHERE lower(email) = lower(?)', [textArg(WANTED_EMAIL)]))
    };
    const removed = { loginRecords: 0, sessions: 0, workoutRecords: 0 };
    if (unwantedIds.length) {
      const placeholders = unwantedIds.map(() => '?').join(',');
      const idArgs = unwantedIds.map(textArg);
      removed.sessions = Number((await execute(
        `DELETE FROM mw_sessions WHERE lower(email) = lower(?) OR user_id IN (${placeholders})`,
        [textArg(UNWANTED_EMAIL), ...idArgs]
      ))?.affected_row_count || 0);
      removed.workoutRecords = Number((await execute(
        `DELETE FROM user_data WHERE lower(email) = lower(?) OR user_id IN (${placeholders})`,
        [textArg(UNWANTED_EMAIL), ...idArgs]
      ))?.affected_row_count || 0);
      removed.loginRecords = Number((await execute(
        `DELETE FROM mw_users WHERE lower(email) = lower(?) OR user_id IN (${placeholders})`,
        [textArg(UNWANTED_EMAIL), ...idArgs]
      ))?.affected_row_count || 0);
    }

    const remaining = scalar(await execute(
      `SELECT
        (SELECT count(*) FROM mw_users WHERE lower(email) = lower(?)) +
        (SELECT count(*) FROM mw_sessions WHERE lower(email) = lower(?)) +
        (SELECT count(*) FROM user_data WHERE lower(email) = lower(?))`,
      [textArg(UNWANTED_EMAIL), textArg(UNWANTED_EMAIL), textArg(UNWANTED_EMAIL)]
    ));
    return json({ unwantedAccountFound: unwantedIds.length > 0, removed, remaining, wanted });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
