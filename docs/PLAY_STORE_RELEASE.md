# Ironvow — Google Play Store Release Readiness

**Goal:** ship Ironvow on Google Play. Free. No ads. No transactions. No in-app purchases.

**Status as of 2026-07-31:** not submittable. Five hard blockers, four defects worth
fixing first, and one administrative requirement that takes **14 calendar days** and
cannot be shortened.

Everything below was verified against the working tree on `develop`, not from memory.
Where I did not verify something, it says so.

---

## App identity — settled 2026-08-01

The app was renamed from **Arium** to **Ironvow**. The old name was semantically
empty (`-arium` is a container suffix) and collided with existing brands.

| Field | Value |
|-------|-------|
| Display name | `Ironvow` |
| Package id | `com.ironvow.app` |
| Play title | `Ironvow` (7 of 30 chars) |

**The package id is permanent from the moment of first publish.** Play has no
rename path for `applicationId` — a change after launch means a new listing with
zero installs and zero reviews. It is now correct in `config.xml:2`; do not touch
it again.

Still open: trademark search (INPI/EUIPO), Play Store name search, and the domain
for the privacy-policy host in §1.2. Do these before the first upload, not after.

---

## Read this first — the 14-day trap

If your Google Play developer account is a **personal** account created after
2023-11-13, Google requires a **closed test with at least 12 testers who stay opted in
for 14 continuous days** before you may apply for production access. The 14 days do not
start until 12 testers have actually joined.

This is not a code problem and no amount of preparation shortens it. Check which account
type you have **before** doing anything else — if it is a personal account, recruit the
12 testers now and let the clock run while the rest of the work happens in parallel.

Organisation accounts are exempt. Verify yours at
Play Console → Settings → Developer account → Account details.

---

## 1. Hard blockers

These stop submission outright. Nothing ships until all five are cleared.

### 1.1 No signing keystore, no AAB build

Play accepts **Android App Bundle** (`.aab`) only for new apps. Cordova builds `.apk` by
default and the project has no signing configuration anywhere.

Missing:
- An upload keystore (`.jks`), generated once, **backed up somewhere you will not lose it**
- A `build.json` or `release-signing.properties` wiring the keystore into the Gradle build
- That file added to `.gitignore` — it holds passwords
- A verified `cordova build android --release -- --packageType=bundle` run

**If you lose the keystore you can never update the app again** under that listing.
Google's Play App Signing mitigates this for the *app* signing key, but the *upload* key
is yours to protect. Back it up before you use it.

### 1.2 No privacy policy URL

Play Console requires a privacy policy URL for **every** app, whether or not it collects
data. Ironvow does collect data, so the policy must be accurate, not boilerplate.

What Ironvow actually transmits — verified in `src/supabase.ts:11-21` and
`src/rankings.ts:100-106`:

| Field | Source | Sent where |
|-------|--------|-----------|
| `device_id` | generated locally, `getDeviceId()` | Supabase `players` table |
| `player_name` | user-entered free text | Supabase `players` table |
| `total_xp` | local progress | Supabase `players` table |
| `level` | derived from XP | Supabase `players` table |
| `rank_letter` | derived from level | Supabase `players` table |

Plus, on every page load, the device's **IP address goes to Google Fonts**
(`fonts.googleapis.com`, `fonts.gstatic.com`) — see §2.1. That is a third-party data
transfer and must be disclosed unless you remove it.

The policy needs a public HTTPS URL. GitHub Pages on this repo is free and sufficient.

### 1.3 Data Safety declaration not answerable

Mandatory form, and Google audits it against observed app behaviour. A declaration that
contradicts what the app does is grounds for removal.

Cannot be filled honestly until §1.2's inventory is settled and §2.1 is decided —
self-hosting the fonts removes an entire third-party disclosure from this form, which is
the main reason §2.1 is worth doing before submission rather than after.

Points that need a deliberate answer:
- `device_id` is a persistent identifier. Google treats "Device or other IDs" as a
  collected data type. You must say yes.
- `player_name` is user-entered and displayed publicly — "Personal info → Name".
- Is the data **collected** (leaves the device to a server you control)? Yes, Supabase.
- Is it **shared** (goes to a third party)? Supabase is your processor, not a third
  party. Google Fonts *is* a third party.
- Is transmission encrypted in transit? Yes, HTTPS.
- Can users request deletion? Yes — Delete Account exists on the profile page and
  `deletePlayer()` in `src/supabase.ts:37` removes the server row. Say so; it is a
  positive signal.

### 1.4 User-generated content with no reporting mechanism — **highest rejection risk**

`player_name` is free text (max 20 chars) and is rendered to **every user** of the app
on the rankings page — `src/rankings.ts:57`. That makes Ironvow a UGC host under Google's
User Generated Content policy, which requires:

1. An **in-app mechanism to report** objectionable content
2. A means to **block abusive users** from the reporting user's view
3. A stated moderation process, and actual moderation

Ironvow has none of the three. The name filter that does exist is a character whitelist
(`src/profil.ts:215`), which stops nothing — it permits any slur spelled with letters.

This is the single most likely cause of rejection, and it is the largest piece of work
of everything on this page. It needs its own design session: a `reports` table with RLS,
a report affordance on each leaderboard row, a device-local block list, and a policy for
what you do when a report arrives.

**Cheaper alternative worth considering:** drop free-text names entirely and generate
handles from a curated word list (`Iron Hound #4417`). No UGC, no reporting requirement,
no moderation burden, and it fits the app's tone. This eliminates blocker 1.4 completely
rather than solving it. Decide this before building anything.

### 1.5 No store assets

None of these exist in the repo. All are required to submit.

| Asset | Spec |
|-------|------|
| App icon | 512×512 PNG, 32-bit, no transparency |
| Feature graphic | 1024×500 PNG or JPEG, no alpha |
| Phone screenshots | 2 minimum, 8 maximum, 16:9 or 9:16, min 320px, max 3840px |
| Short description | ≤ 80 characters |
| Full description | ≤ 4000 characters |
| App title | ≤ 30 characters |

Also required as Console form entries, not files: content rating questionnaire (IARC),
target audience and age group, ads declaration (answer: none), news app declaration
(answer: no), COVID/health declaration — see §3.3.

---

## 2. Defects to fix before shipping

Not policy blockers. All are real problems found in the working tree, and each one is
cheaper to fix now than after the first release.

### 2.1 Google Fonts loaded from CDN on every page

All five pages load three families — Cinzel, Manrope, JetBrains Mono — from
`fonts.googleapis.com`. Verified: 3 link tags on each of `index.html`, `trial.html`,
`chronicle.html`, `rankings.html`, `profile.html`.

Three separate costs:
- **The app looks broken offline.** A fitness app used in a gym basement falls back to
  system fonts, and the Sanctuary design is font-led. This is a first-launch experience
  problem on a device with no signal.
- **Every launch leaks the user's IP to Google.** Forces a third-party disclosure on the
  Data Safety form (§1.3) that self-hosting removes entirely.
- Latency on every page navigation.

Fix: download the WOFF2 files, serve them from `www/fonts/`, replace the three link tags
with `@font-face` rules, and delete `https://fonts.googleapis.com` and
`https://fonts.gstatic.com` from the CSP on all five pages. All three families are
OFL-licensed, so self-hosting is permitted; ship the licence file alongside them.

### 2.2 The app icon is a 4.9 MB image

`www/img/logo.png` is **2048×2048 and 4,893,597 bytes**, and `config.xml:8` points
`<icon src>` at it. The entire `www/` directory is 5.0 MB — the logo is **98% of it**.

There is no `res/` directory, no density buckets, and no adaptive icon. Android 8+ wants
an adaptive icon (separate foreground and background layers); Android 13+ wants a
monochrome layer for themed icons. Without them the launcher shows a shrunken square on
a white plate, which looks amateur next to every other app on the home screen.

Fix: recompress the source, generate the density set (mdpi through xxxhdpi), author
foreground/background/monochrome layers, and declare them in a `<platform name="android">`
block in `config.xml`.

### 2.3 First-run name is stored unsanitized

Two paths write `playerName` and they disagree:

- `src/profil.ts:213-216` — strips to a character whitelist, caps at 20, falls back to `Saint`
- `src/index.ts:60-62` — `input.value.trim() || 'Saint'`, **no filtering, no length cap**

The unsanitized path is the **first-run** one, so it is what most players' names come
from, and `initRankings()` uploads it straight to the public leaderboard
(`src/rankings.ts:102`). The `maxLength` attribute on the input element is the only
guard, and an attribute is not a validation.

Fix: extract the sanitizer into `src/shared.ts` and call it from both paths. Small change,
and it stops being relevant at all if you take the generated-handle option in §1.4.

### 2.4 `config.xml` is 12 lines and pins nothing

No `<platform name="android">` block, no `<preference>` entries, no `<edit-config>`.
Everything currently comes from Cordova defaults, which means it changes silently when
`cordova-android` updates.

Worth pinning explicitly: `android-targetSdkVersion`, `android-minSdkVersion`,
`AndroidXEnabled`, `Orientation`, `AndroidInsecureFileModeEnabled`, and the icon and
splash-screen resource paths.

**Note — this is NOT currently a blocker.** I checked
`platforms/android/cdv-gradle-config.json`: `SDK_VERSION` is **36** and
`MIN_SDK_VERSION` is **24**. Play requires new apps to target API 35 or higher, so the
build already complies. Pinning it in `config.xml` is about not losing that compliance to
a future dependency bump, not about gaining it. *(An earlier note of mine listed target
SDK as a blocker. It was wrong.)*

---

## 3. Verify before submitting — unresolved questions

I could not settle these from the code alone. Each needs a decision or a lookup.

### 3.1 Does Ironvow count as an app with "accounts"?

Google requires apps that support **account creation** to offer in-app account deletion
*and* a **web-accessible deletion URL**. Ironvow has no login — identity is a generated
`device_id`. That is arguably not an account.

But the profile page literally says "Delete Account", and a server row keyed to a
persistent identifier holding a user-chosen name is close enough that a reviewer could
call it one. If they do, you need a public deletion request page — which is cheap to host
next to the privacy policy. **Recommend hosting it regardless.** It costs one static page
and removes an entire category of rejection.

### 3.2 Health app declaration

Play has a Health Apps declaration and specific policies for the Health & Fitness
category. Ironvow tracks exercise but makes no medical claim, offers no diagnosis, and
handles no health records. It should be out of scope, but confirm the current form
wording at submission time — this policy area changes often.

### 3.3 Policy text changes constantly

Everything in §1.5's form list and the requirement in §3.1 reflects Play policy as I
understand it. **Re-read the actual Console requirements when you sit down to submit.**
Google changes these several times a year and a stale checklist is worse than none.

---

## 4. Explicitly out of scope

Recorded so they are decisions rather than oversights.

- **No account system, no backup, no export.** All progress lives in device-local
  SQLite and `localStorage`. Uninstall the app, or lose the phone, and everything is
  gone — including the entire Chronicle history. This is Ironvow's most serious product
  weakness, but it is not a Play Store blocker and it is a separate campaign.
- **No crash reporting.** You will not know when the app breaks in the field.
- **`README.md` is stale** — it describes 4 objectives (there are 5), and it documents
  neither the Chronicle nor the rankings page. Cosmetic, but it is the first thing
  anyone reads.

---

## 5. Execution order

The dependencies are real; this order avoids doing work twice.

1. **Check the developer account type.** If personal, start recruiting 12 testers today.
   The 14-day clock is the long pole and runs in parallel with everything else.
2. **Decide §1.4 — free-text names or generated handles.** This choice determines whether
   there is a UGC campaign at all, and it changes §2.3 and the privacy policy text.
3. **Self-host the fonts (§2.1).** Do this before the Data Safety form so the form is
   simpler.
4. **Fix the icon (§2.2) and `config.xml` (§2.4).** Same area of the build, one pass.
5. **Fix name sanitization (§2.3)** — unless step 2 removed it.
6. **Write the privacy policy and deletion page**, host on GitHub Pages, get the URLs.
7. **Generate the keystore, build a signed AAB (§1.1),** back the keystore up in two
   places.
8. **Produce store assets (§1.5)** — screenshots come last, from the finished build.
9. **Fill the Console forms** — Data Safety, content rating, target audience, ads.
10. **Upload to closed testing.** If the 14-day clock started at step 1, it may already
    be satisfied.

Steps 3-5 are code. Step 6 is prose. Steps 1, 7-10 are yours to execute; I can prepare
every input for them.

---

*Compiled 2026-07-31 against `develop` @ `ebec2fa`. Every file and line reference was
read at that commit. Google Play policy details should be re-confirmed at submission.*
