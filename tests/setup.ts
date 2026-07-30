// Loaded before every test suite via setupFiles in jest.config.js.
// Only require()s are allowed here — the Jest framework (beforeEach, expect)
// is not yet available at this stage.

// Provide Supabase globals that supabase.ts reads as ambient globals.
// The real values live in www/js/supabase.config.js (gitignored).
(global as Record<string, unknown>).SUPABASE_URL      = 'https://test.supabase.co';
(global as Record<string, unknown>).SUPABASE_ANON_KEY = 'test-anon-key';

require('../src/shared');
