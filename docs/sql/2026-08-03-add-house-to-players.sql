-- Adds the cosmetic zodiac house to the leaderboard row, so a Saint's glyph
-- travels with their name onto every other player's Rankings page.
--
-- Run once, in the Supabase SQL editor, against the project this build points
-- at. Safe to re-run: every statement is idempotent.
--
-- Nullable and unconstrained by default on purpose. Every row that exists
-- today was written before this column did, and a player who has never chosen
-- a house keeps writing NULL — src/rankings.ts draws no badge for either case.
-- No RLS change is needed: the existing own-write/own-update policies match on
-- device_id and say nothing about which columns a row carries.

alter table public.players
  add column if not exists house text;

-- The twelve ids are the same contract src/houses.ts documents. Enforced here
-- as well as in the client because the anon key is in the app bundle, and a
-- free-text column reachable with it is a free-text column anyone can write.
alter table public.players
  drop constraint if exists players_house_check;

alter table public.players
  add constraint players_house_check
  check (house is null or house in (
    'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'
  ));

-- PostgREST caches the schema. Supabase usually reloads on DDL by itself, but
-- without this a fresh column can 400 with PGRST204 until it gets around to it.
notify pgrst, 'reload schema';
