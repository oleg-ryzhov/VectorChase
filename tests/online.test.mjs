import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOnline, SUBMIT_PATH } from '../src/online/client.js';
import { MAP_LIMITS, limitsFor, validateSubmission } from '../netlify/functions/lib/validate.mjs';
import submit from '../netlify/functions/submit-score.mjs';
import { MAPS } from '../src/maps/index.js';

const mem = () => {
  const d = new Map();
  return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => d.set(k, v), removeItem: (k) => d.delete(k) };
};
const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });
const cfg = { url: 'https://x.supabase.co/', anonKey: 'anon' };

test('score limits cover exactly the maps in the game', () => {
  assert.deepEqual(Object.keys(MAP_LIMITS).sort(), MAPS.map((m) => m.id).sort());
});

test('lap checks: believable times pass, others are refused', () => {
  const min = limitsFor('suzuka').minMs;
  assert.ok(validateSubmission({ mapId: 'suzuka', timeMs: min }).ok);
  assert.ok(validateSubmission({ mapId: 'suzuka', timeMs: 95000 }).ok);
  assert.ok(limitsFor('alpine').minMs < limitsFor('city').minMs * (3757 / 3446)); // shortcut maps allow less
  for (const bad of [{ mapId: 'suzuka', timeMs: min - 1 }, { mapId: 'suzuka', timeMs: 1e9 }, { mapId: 'suzuka', timeMs: 90000.5 }, { mapId: 'nope', timeMs: 90000 }, { mapId: '__proto__', timeMs: 90000 }, { mapId: 'suzuka', timeMs: '90000' }, null, [], 'x']) {
    assert.equal(validateSubmission(bad).ok, false, JSON.stringify(bad));
  }
});

test('offline by default: nothing is sent', async () => {
  const o = createOnline({ fetchFn: () => assert.fail('no network') });
  assert.equal(o.enabled, false);
  await assert.rejects(o.signIn('a@b.c', 'pw'), /not set up/);
});

test('sign up, sign in, keep the session, refresh it and sign out', async () => {
  const storage = mem();
  const calls = [];
  let t = 1_000_000;
  const fetchFn = async (url, init) => {
    calls.push([url, init.method, init.headers.authorization]);
    if (url.includes('grant_type=password')) return reply(200, { access_token: 'a1', refresh_token: 'r1', expires_in: 3600, user: { user_metadata: { username: 'Oleg_1' } } });
    if (url.includes('grant_type=refresh_token')) return reply(200, { access_token: 'a2', refresh_token: 'r2', expires_in: 3600, user: { user_metadata: { username: 'Oleg_1' } } });
    if (url.endsWith('/signup')) return reply(200, { user: { id: 'u' } }); // email confirmation needed
    return reply(200, {});
  };
  const o = createOnline({ ...cfg, storage, fetchFn, now: () => t });
  await assert.rejects(o.signUp('a@b.c', 'password1', 'x'), /Username/);
  assert.deepEqual(await o.signUp('a@b.c', 'password1', 'Oleg_1'), { signedIn: false, needsConfirm: true });
  await o.signIn('a@b.c', 'password1');
  assert.equal(o.user.username, 'Oleg_1');
  assert.equal(createOnline({ ...cfg, storage, fetchFn, now: () => t }).user.username, 'Oleg_1'); // survives a reload
  t += 3_600_000; // the token has run out
  const sent = [];
  const o2 = createOnline({ ...cfg, storage, now: () => t, fetchFn: async (u, i) => (sent.push([u, i.headers.authorization]), u === SUBMIT_PATH ? reply(200, { ok: true }) : fetchFn(u, i)) });
  await o2.submitScore({ mapId: 'oval', timeMs: 60000 });
  assert.equal(sent.at(-1)[1], 'Bearer a2'); // used the refreshed token
  await o2.signOut();
  assert.equal(o2.user, null);
  assert.equal(storage.getItem('vectorchase.online'), null);
});

test('errors are readable; the network failing is not a crash', async () => {
  const o = createOnline({ ...cfg, fetchFn: async () => reply(400, { msg: 'Invalid login credentials' }) });
  await assert.rejects(o.signIn('a@b.c', 'bad'), /Wrong email or password/);
  const down = createOnline({ ...cfg, fetchFn: async () => { throw new Error('offline'); } });
  await assert.rejects(down.leaderboard('oval'), /Could not reach/);
  await assert.rejects(down.submitScore({ mapId: 'oval', timeMs: 60000 }), /Sign in/);
});

test('leaderboard asks for the right rows', async () => {
  let asked = '';
  const o = createOnline({ ...cfg, fetchFn: async (u) => ((asked = u), reply(200, [{ username: 'a', best_ms: 1, runs: 1 }])) });
  assert.equal((await o.leaderboard('oval&x=1', 999)).length, 1);
  assert.match(asked, /map_id=eq\.oval%26x%3D1/);
  assert.match(asked, /limit=100$/);
});

// ---- The Netlify function, with a fake database ----
function fakeDb({ user = { id: '123e4567-e89b-12d3-a456-426614174000' }, banned = false, last = [] } = {}) {
  const log = [];
  globalThis.fetch = async (url, init = {}) => {
    log.push([url, init.method ?? 'GET', init.body]);
    if (url.endsWith('/auth/v1/user')) return init.headers.authorization === 'Bearer good' ? reply(200, user) : reply(401, {});
    if (url.includes('/profiles?')) return reply(200, [{ banned }]);
    if (url.includes('/scores?user_id')) return reply(200, last);
    if (url.endsWith('/rest/v1/scores')) return { ok: true, status: 201, json: async () => null };
    throw new Error('unexpected ' + url);
  };
  return log;
}
const post = (body, token = 'good') => new Request('https://game/.netlify/functions/submit-score', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: typeof body === 'string' ? body : JSON.stringify(body) });
const good = { mapId: 'oval', timeMs: 60000 };

test('function: stores a valid score using the service key', async () => {
  process.env.SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'svc';
  const log = fakeDb();
  const res = await submit(post(good));
  assert.equal(res.status, 200);
  const insert = log.at(-1);
  assert.deepEqual(JSON.parse(insert[2]), { user_id: '123e4567-e89b-12d3-a456-426614174000', map_id: 'oval', time_ms: 60000 });
});

test('function: refuses bad requests, bad logins, bans and spam', async () => {
  process.env.SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'svc';
  fakeDb();
  assert.equal((await submit(new Request('https://g/', { method: 'GET' }))).status, 405);
  assert.equal((await submit(post(good, null))).status, 401);
  assert.equal((await submit(post(good, 'forged'))).status, 401);
  assert.equal((await submit(post('{not json'))).status, 400);
  assert.equal((await submit(post({ mapId: 'oval', timeMs: 5 }))).status, 422);
  assert.equal((await submit(post('x'.repeat(2000)))).status, 413);
  fakeDb({ banned: true });
  assert.equal((await submit(post(good))).status, 403);
  fakeDb({ last: [{ created_at: new Date().toISOString() }] });
  assert.equal((await submit(post(good))).status, 429);
  fakeDb({ user: { id: "1; drop table scores" } });
  assert.equal((await submit(post(good))).status, 401);
  delete process.env.SUPABASE_SERVICE_KEY;
  assert.equal((await submit(post(good))).status, 500);
});
