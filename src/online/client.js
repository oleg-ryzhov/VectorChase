// Online accounts and leaderboards, talking to Supabase over plain fetch (no build step, no SDK).
// Offline when no url and key are configured: enabled is false and the game works as before.
// fetchFn and storage are passed in so tests can use fakes.

const KEY = 'vectorchase.online';
const NAME = /^[A-Za-z0-9_]{3,16}$/;
export const SUBMIT_PATH = '/.netlify/functions/submit-score';

function friendly(data, status) {
  const text = String(data?.msg ?? data?.error_description ?? data?.message ?? data?.error ?? '');
  if (/invalid login credentials/i.test(text)) return 'Wrong email or password.';
  if (/already registered/i.test(text)) return 'That email is already registered. Try signing in.';
  if (/database error saving new user/i.test(text)) return 'That username is taken or not allowed.';
  if (/password should be/i.test(text) || /weak/i.test(text)) return 'Choose a longer password (at least 8 characters).';
  if (/email not confirmed/i.test(text)) return 'Confirm your email first: check your inbox.';
  if (status === 429) return 'Too many tries. Wait a minute.';
  return text || `Something went wrong (${status}).`;
}

export function createOnline({ url = '', anonKey = '', storage = null, fetchFn = (...a) => fetch(...a), now = () => Date.now() } = {}) {
  const base = String(url).replace(/\/+$/, '');
  const enabled = Boolean(base && anonKey);
  let session = null;
  try {
    const s = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (s && s.access_token && s.refresh_token) session = s;
  } catch {
    /* unreadable: signed out */
  }

  function keep(next) {
    session = next;
    try {
      if (next) storage?.setItem(KEY, JSON.stringify(next));
      else storage?.removeItem(KEY);
    } catch {
      /* storage blocked: stays signed in for this visit */
    }
  }

  async function request(target, { method = 'GET', body, token } = {}) {
    let res;
    try {
      res = await fetchFn(target, {
        method,
        headers: { apikey: anonKey, authorization: `Bearer ${token ?? anonKey}`, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error('Could not reach the server. Check your connection.');
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* no body */
    }
    if (!res.ok) throw new Error(friendly(data, res.status));
    return data;
  }

  const toSession = (d) => ({
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: d.expires_at ?? Math.floor(now() / 1000) + (d.expires_in ?? 3600),
    username: d.user?.user_metadata?.username ?? '',
  });

  function need() {
    if (!enabled) throw new Error('Online play is not set up.');
  }

  // A token that is still valid, refreshed first if it is about to run out. Null when signed out.
  async function validToken() {
    if (!session) return null;
    if (session.expires_at * 1000 - now() > 60000) return session.access_token;
    try {
      keep(toSession(await request(`${base}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', body: { refresh_token: session.refresh_token } })));
      return session.access_token;
    } catch (err) {
      if (!/reach the server/.test(err.message)) keep(null); // refused: the session is gone
      return null;
    }
  }

  return {
    enabled,
    get user() {
      return session ? { username: session.username } : null;
    },
    async signUp(email, password, username) {
      need();
      if (!NAME.test(username)) throw new Error('Username: 3 to 16 letters, numbers or _.');
      const d = await request(`${base}/auth/v1/signup`, { method: 'POST', body: { email, password, data: { username } } });
      if (d?.access_token) {
        keep(toSession({ ...d, user: d.user ?? { user_metadata: { username } } }));
        return { signedIn: true };
      }
      return { signedIn: false, needsConfirm: true };
    },
    async signIn(email, password) {
      need();
      keep(toSession(await request(`${base}/auth/v1/token?grant_type=password`, { method: 'POST', body: { email, password } })));
    },
    async signOut() {
      const token = session?.access_token;
      keep(null);
      if (enabled && token) await request(`${base}/auth/v1/logout`, { method: 'POST', token }).catch(() => {});
    },
    // Best time per player on one map, fastest first.
    async leaderboard(mapId, limit = 50) {
      need();
      const n = Math.max(1, Math.min(100, Math.floor(limit)));
      const rows = await request(`${base}/rest/v1/leaderboard?map_id=eq.${encodeURIComponent(mapId)}&select=username,best_ms,runs&order=best_ms.asc&limit=${n}`);
      return Array.isArray(rows) ? rows : [];
    },
    // The server checks the time again; this only sends it.
    async submitScore({ mapId, timeMs }) {
      need();
      const token = await validToken();
      if (!token) throw new Error('Sign in to post online scores.');
      let res;
      try {
        res = await fetchFn(SUBMIT_PATH, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ mapId, timeMs }) });
      } catch {
        throw new Error('Could not reach the server. Check your connection.');
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `Could not post the score (${res.status}).`);
    },
  };
}
