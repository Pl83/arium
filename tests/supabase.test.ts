// shared.ts is already on global via setup.ts

let supabaseModule: any;

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  jest.resetModules();
  // SUPABASE_URL / SUPABASE_ANON_KEY are set globally in tests/setup.ts
  require('../src/shared');
  supabaseModule = require('../src/supabase');
});

// ── upsertPlayer ──────────────────────────────────────────────────────────────

describe('upsertPlayer', () => {
  it('sends a POST request to the players endpoint', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    await supabaseModule.upsertPlayer({
      device_id: 'test-uuid',
      player_name: 'Hunter',
      total_xp: 100,
      level: 2,
      rank_letter: 'E',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/rest/v1/players');
    expect(options.method).toBe('POST');
  });

  it('includes apikey and Authorization headers', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    await supabaseModule.upsertPlayer({
      device_id: 'test-uuid',
      player_name: 'Hunter',
      total_xp: 0,
      level: 1,
      rank_letter: 'E',
    });

    const options = mockFetch.mock.calls[0][1];
    expect(options.headers['apikey']).toBe(supabaseModule.SUPABASE_ANON_KEY);
    expect(options.headers['Authorization']).toContain(supabaseModule.SUPABASE_ANON_KEY);
  });

  it('includes the Prefer merge-duplicates header', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    await supabaseModule.upsertPlayer({
      device_id: 'test-uuid',
      player_name: 'Hunter',
      total_xp: 0,
      level: 1,
      rank_letter: 'E',
    });

    const options = mockFetch.mock.calls[0][1];
    expect(options.headers['Prefer']).toBe('resolution=merge-duplicates');
  });

  it('includes x-device-id header matching the player device_id (for RLS)', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    await supabaseModule.upsertPlayer({
      device_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      player_name: 'Hunter',
      total_xp: 0,
      level: 1,
      rank_letter: 'E',
    });

    const options = mockFetch.mock.calls[0][1];
    expect(options.headers['x-device-id']).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  });

  it('sends all player fields plus updated_at in the body', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    await supabaseModule.upsertPlayer({
      device_id: 'abc-123',
      player_name: 'Atlas',
      total_xp: 500,
      level: 4,
      rank_letter: 'E',
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.device_id).toBe('abc-123');
    expect(body.player_name).toBe('Atlas');
    expect(body.total_xp).toBe(500);
    expect(body.level).toBe(4);
    expect(body.rank_letter).toBe('E');
    expect(typeof body.updated_at).toBe('string');
  });
});

// ── fetchLeaderboard ──────────────────────────────────────────────────────────

describe('fetchLeaderboard', () => {
  it('returns parsed JSON rows on a 200 response', async () => {
    const rows = [
      { device_id: 'a', player_name: 'Atlas', total_xp: 500, level: 4, rank_letter: 'E', updated_at: '' },
    ];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(rows),
    });

    const result = await supabaseModule.fetchLeaderboard();
    expect(result).toEqual(rows);
  });

  it('sends a GET request to the players endpoint with order param', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await supabaseModule.fetchLeaderboard();

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/rest/v1/players');
    expect(url).toContain('order=total_xp.desc');
  });

  it('throws an error on a non-OK HTTP status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });

    await expect(supabaseModule.fetchLeaderboard()).rejects.toThrow('503');
  });

  it('includes apikey header on GET request', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await supabaseModule.fetchLeaderboard();

    const options = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(options.headers['apikey']).toBe(supabaseModule.SUPABASE_ANON_KEY);
  });
});
