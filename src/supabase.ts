// SUPABASE_URL and SUPABASE_ANON_KEY are globals injected at runtime by
// www/js/supabase.config.js (gitignored — copy from supabase.config.example.js).
// They are declared as ambient globals in src/types/globals.d.ts.

const SUPABASE_HEADERS: Record<string, string> = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
  'Content-Type': 'application/json',
};

async function upsertPlayer(data: Omit<PlayerRow, 'updated_at'>): Promise<void> {
  await fetch(SUPABASE_URL + '/rest/v1/players', {
    method: 'POST',
    headers: {
      ...SUPABASE_HEADERS,
      'Prefer':      'resolution=merge-duplicates',
      'x-device-id': data.device_id,  // matched by the RLS "own write/update" policies
    },
    body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
  });
}

// Removes this device's leaderboard row.
//
// PostgREST answers a DELETE that RLS refused with 204 and zero rows — exactly
// what it returns when the row was never there. Treating either as success
// would wipe local progress while the leaderboard entry lived on, so the row is
// looked up first and the two cases are reported separately:
//
//   'deleted' — the row existed and the server confirmed its removal
//   'absent'  — there was never a row (player never synced); nothing to remove
//   'failed'  — the row exists and was NOT removed, or the request errored
//
// Callers must only destroy local data on 'deleted' or 'absent'.
type DeleteOutcome = 'deleted' | 'absent' | 'failed';

async function deletePlayer(deviceId: string): Promise<DeleteOutcome> {
  const query = '?device_id=eq.' + encodeURIComponent(deviceId);

  try {
    const existing = await fetch(
      SUPABASE_URL + '/rest/v1/players' + query + '&select=device_id',
      { headers: SUPABASE_HEADERS },
    );
    if (!existing.ok) return 'failed';
    const found = await existing.json() as unknown[];
    if (!Array.isArray(found) || found.length === 0) return 'absent';

    const res = await fetch(SUPABASE_URL + '/rest/v1/players' + query, {
      method: 'DELETE',
      headers: {
        ...SUPABASE_HEADERS,
        'Prefer':      'return=representation',  // so we can count what went
        'x-device-id': deviceId,                 // matched by the RLS policy
      },
    });
    if (!res.ok) return 'failed';
    const removed = await res.json() as unknown[];
    return Array.isArray(removed) && removed.length > 0 ? 'deleted' : 'failed';
  } catch {
    return 'failed';
  }
}

async function fetchLeaderboard(): Promise<PlayerRow[]> {
  const res = await fetch(
    SUPABASE_URL + '/rest/v1/players?select=*&order=total_xp.desc',
    { headers: SUPABASE_HEADERS },
  );
  if (!res.ok) throw new Error('fetchLeaderboard failed: ' + res.status);
  return res.json() as Promise<PlayerRow[]>;
}

// === NODE/JEST EXPORT — invisible in browser ===
/* istanbul ignore else */
if (typeof module !== 'undefined') {
  global.upsertPlayer     = upsertPlayer;
  global.fetchLeaderboard = fetchLeaderboard;
  global.deletePlayer     = deletePlayer;
  module.exports = { upsertPlayer, fetchLeaderboard, deletePlayer, SUPABASE_URL, SUPABASE_ANON_KEY };
}
