// Receives a lap time from a signed-in player, checks it, and stores it. This is the ONLY way into the
// scores table. Needs two Netlify environment variables (never put them in the repository):
//   SUPABASE_URL           the project URL
//   SUPABASE_SERVICE_KEY   the service_role key (secret)
import { validateSubmission, MIN_GAP_MS } from './lib/validate.mjs';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only.' });
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return json(500, { error: 'The server is not set up for online scores yet.' });

  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json(401, { error: 'Sign in first.' });

  let body;
  try {
    const text = await req.text();
    if (text.length > 1000) return json(413, { error: 'Too large.' });
    body = JSON.parse(text);
  } catch {
    return json(400, { error: 'Bad request.' });
  }
  const checked = validateSubmission(body);
  if (!checked.ok) return json(422, { error: checked.error });

  try {
    // Who is this? Supabase checks the token for us.
    const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, authorization: auth } });
    if (!who.ok) return json(401, { error: 'Sign in again.' });
    const { id } = await who.json();
    if (typeof id !== 'string' || !UUID.test(id)) return json(401, { error: 'Sign in again.' });

    const db = (path, init = {}) =>
      fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', ...init.headers } });

    const profile = await (await db(`profiles?id=eq.${id}&select=banned`)).json();
    if (!Array.isArray(profile) || profile.length === 0 || profile[0].banned) return json(403, { error: 'This account cannot post scores.' });

    const last = await (await db(`scores?user_id=eq.${id}&select=created_at&order=created_at.desc&limit=1`)).json();
    if (Array.isArray(last) && last.length > 0 && Date.now() - Date.parse(last[0].created_at) < MIN_GAP_MS) {
      return json(429, { error: 'Too fast. Try again in a few seconds.' });
    }

    const saved = await db('scores', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ user_id: id, map_id: checked.mapId, time_ms: checked.timeMs }) });
    if (!saved.ok) return json(502, { error: 'Could not save the score.' });
    return json(200, { ok: true });
  } catch {
    return json(502, { error: 'The score service is not reachable.' });
  }
};
