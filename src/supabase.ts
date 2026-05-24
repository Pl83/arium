const SUPABASE_URL      = 'https://llqqjocifvxjbwzspkrt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxscXFqb2NpZnZ4amJ3enNwa3J0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTUwMzEsImV4cCI6MjA5NDc5MTAzMX0.0YdpODP0xdHEIX0Jf3cPzHgRj51BzJvBDDlremnjzxM';

const SUPABASE_HEADERS: Record<string, string> = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
  'Content-Type': 'application/json',
};

async function upsertPlayer(data: Omit<PlayerRow, 'updated_at'>): Promise<void> {
  await fetch(SUPABASE_URL + '/rest/v1/players', {
    method: 'POST',
    headers: { ...SUPABASE_HEADERS, 'Prefer': 'resolution=merge-duplicates' },
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
