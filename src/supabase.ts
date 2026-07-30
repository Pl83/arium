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
  module.exports = { upsertPlayer, fetchLeaderboard, SUPABASE_URL, SUPABASE_ANON_KEY };
}
