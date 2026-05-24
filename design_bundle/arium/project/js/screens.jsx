// All 5 screens + Rank-up modal. Each takes the active `t` theme.
// Screens are dumb components driven by parent state (current tab, quest list, modal flag).

const MOCK_QUESTS_INIT = [
  { name: 'Push-Ups', cur: 0, max: 42, unit: '', stat: 'strength' },
  { name: 'Sit-Ups',  cur: 42, max: 42, unit: '', stat: 'core' },
  { name: 'Squats',   cur: 0, max: 42, unit: '', stat: 'power' },
  { name: 'Plank',    cur: 0, max: 85, unit: 's', stat: 'endurance' },
];

const MOCK = {
  name: 'AXEL',
  level: 12,
  pct: 23,
  rank: { letter: 'C', title: 'Warrior' },
  nextRank: { letter: 'B', atLevel: 20 },
  attrs: { strength: 24, core: 18, power: 21, endurance: 15 },
  totalXP: 7320,
  totalCompleted: 184,
};

const SOLO_EX = [
  { name: 'Push-Ups',     stat: 'strength',  target: '42 reps' },
  { name: 'Sit-Ups',      stat: 'core',      target: '42 reps' },
  { name: 'Squats',       stat: 'power',     target: '42 reps' },
  { name: 'Plank',        stat: 'endurance', target: '1:25' },
  { name: 'Pull-Ups',     stat: 'strength',  target: '16 reps' },
  { name: 'Burpees',      stat: 'power',     target: '19 reps' },
  { name: 'Lunges',       stat: 'power',     target: '37 reps' },
  { name: 'Mt. Climbers', stat: 'endurance', target: '0:55' },
];

const CHALLENGES = [
  { name: 'Core Inferno',   stat: 'core',      ex: 'Crunch · Twist · Leg Raise',     xp: 121 },
  { name: 'Upper Burn',     stat: 'strength',  ex: 'Push-Ups · Dips · Pull-Ups',     xp: 121 },
  { name: 'Leg Day',        stat: 'power',     ex: 'Squats · Lunges · Burpees',      xp: 121 },
  { name: 'Cardio Blast',   stat: 'endurance', ex: 'Burpees · Mt. Climbers · Jacks', xp: 121 },
];

const LEADERBOARD = {
  S: [ { n: 'KORVUS',   lv: 58, xp: 168400 }, { n: 'AURELIA',  lv: 52, xp: 134220 } ],
  A: [ { n: 'BRAM',     lv: 42, xp:  86120 }, { n: 'NYX',      lv: 38, xp:  71880 }, { n: 'TARO', lv: 36, xp: 65200 } ],
  B: [ { n: 'IZUMI',    lv: 26, xp:  32400 }, { n: 'CALI',     lv: 22, xp:  24180 } ],
  C: [ { n: 'AXEL',     lv: 12, xp:   7320, me: true }, { n: 'ROOK', lv: 11, xp: 6200 }, { n: 'SAM', lv: 10, xp: 5440 } ],
  D: [ { n: 'JUNI',     lv:  7, xp:   2120 }, { n: 'OWEN',     lv:  6, xp:  1700 } ],
};

// ════════════════════════════════════════════════════════════════════
// HOME SCREEN — daily quests
// ════════════════════════════════════════════════════════════════════
function HomeScreen({ t, quests, onToggleQuest, onShowRankUp, onShowPenalty }) {
  const completed = quests.filter(q => q.cur >= q.max).length;
  const allDone = completed === quests.length;

  return (
    <div style={{ padding: '16px 14px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top status strip — name + level bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontFamily: t.mono, fontSize: 9, color: t.fgDim, letterSpacing: '0.2em' }}>HUNTER</span>
            <span style={{ fontFamily: t.display, fontSize: 18, color: t.fg, letterSpacing: '0.12em', fontWeight: 700, textShadow: t.mode==='dark' && t.id!=='v3' ? `0 0 14px ${t.accentSoft}` : 'none' }}>{MOCK.name}</span>
          </div>
          <RankBadge t={t} letter={MOCK.rank.letter} title={MOCK.rank.title} />
        </div>
        <XpBar t={t} level={MOCK.level} pct={MOCK.pct} />
      </div>

      {/* Daily quest panel */}
      <Panel t={t} accent style={{ padding: t.id === 'v2' ? '28px 18px 22px' : '20px 18px' }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 14, position: 'relative' }}>
          {t.id === 'v2' && (
            <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)' }}>
              <DiamondGlyph s={32} c={t.accent} glow={t.mode==='dark' ? t.accent : ''} />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 14px', borderTop: t.id !== 'v3' ? `1px solid ${t.accent}` : 'none', borderBottom: t.id !== 'v3' ? `1px solid ${t.accent}` : 'none', marginTop: t.id === 'v2' ? 18 : 0, whiteSpace: 'nowrap' }}>
            {t.id !== 'v3' && <SystemSigil s={14} c={t.accent} />}
            <span style={{ fontFamily: t.display, fontSize: t.id === 'v3' ? 16 : 11, color: t.accent, letterSpacing: t.id==='v3' ? '-0.01em' : '0.25em', fontWeight: 700, textTransform: t.id==='v3' ? 'none' : 'uppercase', textShadow: t.mode==='dark' && t.id !=='v3' ? `0 0 10px ${t.accent}` : 'none', whiteSpace: 'nowrap' }}>
              {t.id === 'v3' ? 'Today\'s quests' : 'Daily Quest'}
            </span>
          </div>
          <span style={{ fontFamily: t.body, fontSize: 10, color: t.fgMuted, textAlign: 'center', letterSpacing: t.id==='v3' ? 'normal' : '0.08em' }}>
            {t.id === 'v3' ? 'Train daily to grow your power.' : 'TRAIN TO BECOME A FORMIDABLE COMBATANT'}
          </span>
        </div>

        {/* Boss sigil (V2 only) — central crystal that "cracks" as completion progresses */}
        {t.id === 'v2' && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <BossSigil t={t} completed={completed} total={quests.length} />
          </div>
        )}

        {/* Progress label */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontFamily: t.id === 'v3' ? t.body : t.mono, fontSize: 10, color: allDone ? t.success : t.fgMuted, letterSpacing: t.id==='v3' ? '0.02em' : '0.18em', fontWeight: 700 }}>
            {allDone ? '◆ ALL OBJECTIVES CLEARED' : `OBJECTIVES — ${completed}/${quests.length}`}
          </span>
          {!allDone && <span style={{ fontFamily: t.mono, fontSize: 9, color: t.fgDim, letterSpacing: '0.12em' }}>+25 XP each</span>}
        </div>

        {/* Quest list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: t.id === 'v3' ? 8 : 0 }}>
          {quests.map((q, i) => <QuestRow key={i} t={t} q={q} onTap={() => onToggleQuest(i)} />)}
        </div>

        {/* Footer warning */}
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <span style={{ fontFamily: t.body, fontSize: 9, color: t.fgMuted, letterSpacing: t.id==='v3' ? 'normal' : '0.1em' }}>
            <span style={{ color: t.danger, fontWeight: 700 }}>{t.id === 'v3' ? 'Heads up:' : 'CAUTION:'}</span> {t.id === 'v3' ? 'unfinished quests cost XP.' : 'INCOMPLETE QUESTS CARRY PENALTIES.'}
          </span>
        </div>
      </Panel>

      {/* Demo trigger row — tap to fire the rank-up modal */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn t={t} variant="secondary" onClick={onShowRankUp}>{t.id === 'v3' ? 'Preview rank-up' : 'TEST: RANK UP'}</Btn>
        <Btn t={t} variant="secondary" onClick={onShowPenalty}>{t.id === 'v3' ? 'Preview penalty' : 'TEST: PENALTY'}</Btn>
      </div>
    </div>
  );
}

function QuestRow({ t, q, onTap }) {
  const done = q.cur >= q.max;
  const pct = Math.min(q.cur / q.max, 1);
  if (t.id === 'v3') {
    return (
      <button onClick={onTap} style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
        background: done ? t.accentSoft : t.mode==='dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
        border: 'none', borderRadius: 14, textAlign: 'left', cursor: 'pointer', width: '100%',
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          background: done ? t.accent : 'transparent',
          border: `1.5px solid ${done ? t.accent : t.fgDim}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {done && <CheckIcon s={14} c={t.mode==='dark' ? '#0B0B0E' : '#fff'} sw={2.5} />}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontFamily: t.body, fontSize: 14, fontWeight: 600, color: done ? t.fgMuted : t.fg, textDecoration: done ? 'line-through' : 'none' }}>{q.name}</span>
          <div style={{ height: 4, background: t.mode==='dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${pct*100}%`, height: '100%', background: t.attr[q.stat] || t.accent, transition: 'width 0.5s' }} />
          </div>
        </div>
        <span style={{ fontFamily: t.mono, fontSize: 12, color: done ? t.fgDim : t.fg, fontVariantNumeric: 'tabular-nums' }}>{q.cur}/{q.max}{q.unit}</span>
      </button>
    );
  }
  // V1 / V2 — flat row with striked-through look
  return (
    <button onClick={onTap} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0', background: 'none', border: 'none', borderBottom: `1px solid ${t.panelBorder}`,
      textAlign: 'left', cursor: 'pointer', width: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
        <div style={{
          width: 6, height: 6, transform: 'rotate(45deg)',
          background: done ? t.success : t.attr[q.stat],
          boxShadow: t.mode==='dark' ? `0 0 6px ${done ? t.success : t.attr[q.stat]}` : 'none',
        }} />
        <span style={{
          fontFamily: t.id === 'v2' ? t.display : t.body, fontSize: 11, color: done ? `${t.success}AA` : t.fg,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          textDecoration: done ? 'line-through' : 'none', textDecorationColor: t.success, textDecorationThickness: 1.5,
        }}>{q.name}</span>
      </div>
      <span style={{ fontFamily: t.mono, fontSize: 11, color: done ? t.success : t.accent, letterSpacing: '0.08em', fontVariantNumeric: 'tabular-nums' }}>
        [{done ? q.max : q.cur}/{q.max}{q.unit}]
      </span>
    </button>
  );
}

// — V2 boss sigil: faceted diamond that fills as completion grows —
function BossSigil({ t, completed, total }) {
  const pct = total > 0 ? completed / total : 0;
  const allDone = completed === total;
  const c = allDone ? t.success : t.accent;
  return (
    <div style={{ position: 'relative', width: 80, height: 92 }}>
      <svg width="80" height="92" viewBox="0 0 80 92" style={{ filter: t.mode==='dark' ? `drop-shadow(0 0 14px ${c})` : 'none' }}>
        <defs>
          <linearGradient id="bsg" x1="0" y1="0" x2="0" y2="1">
            <stop offset={`${(1 - pct) * 100}%`} stopColor={c} stopOpacity="0" />
            <stop offset={`${(1 - pct) * 100}%`} stopColor={c} stopOpacity="0.6" />
            <stop offset="100%" stopColor={c} stopOpacity="0.4" />
          </linearGradient>
        </defs>
        {/* outer faceted diamond */}
        <path d="M40 4L74 30L60 88H20L6 30L40 4z" stroke={c} strokeWidth="1.5" fill={t.mode==='dark' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)'} />
        {/* inner facets */}
        <path d="M40 4L40 88M6 30L74 30M20 88L40 30L60 88" stroke={c} strokeWidth="0.8" opacity="0.5" fill="none" />
        {/* fill */}
        <path d="M40 4L74 30L60 88H20L6 30L40 4z" fill="url(#bsg)" />
        {/* center rune */}
        <text x="40" y="60" textAnchor="middle" fontSize="20" fill={c} fontWeight="700" fontFamily="'Cinzel', serif" style={{ textShadow: `0 0 8px ${c}` }}>{completed}</text>
        <text x="40" y="75" textAnchor="middle" fontSize="8" fill={t.fgMuted} letterSpacing="2" fontFamily="'Cinzel', serif">/{total}</text>
      </svg>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// TRIAL PICKER SCREEN
// ════════════════════════════════════════════════════════════════════
function TrialScreen({ t, onPick }) {
  const [tab, setTab] = React.useState('solo');
  return (
    <div style={{ padding: '20px 14px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {t.id !== 'v3' && <span style={{ fontFamily: t.mono, fontSize: 9, color: t.fgDim, letterSpacing: '0.25em' }}>TRIAL SELECTION</span>}
        <h1 style={{ fontFamily: t.display, fontSize: t.id==='v3' ? 24 : 18, color: t.fg, letterSpacing: t.id==='v3' ? '-0.02em' : '0.15em', fontWeight: 700, textShadow: t.mode==='dark' && t.id!=='v3' ? `0 0 14px ${t.accentSoft}` : 'none' }}>
          {t.id === 'v3' ? 'Choose your workout' : 'CHOOSE YOUR TRIAL'}
        </h1>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        background: t.id==='v3' ? (t.mode==='dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)') : 'transparent',
        borderRadius: t.id==='v3' ? 12 : 0,
        borderBottom: t.id!=='v3' ? `1px solid ${t.panelBorder}` : 'none',
        padding: t.id==='v3' ? 4 : 0,
      }}>
        {[{ k:'solo', l:'Solo' }, { k:'chal', l: t.id==='v3' ? 'Challenges' : 'Challenges' }].map(({ k, l }) => {
          const on = tab === k;
          return (
            <button key={k} onClick={() => setTab(k)} style={{
              flex: 1, background: on && t.id==='v3' ? t.panel : 'transparent',
              border: 'none', cursor: 'pointer',
              borderBottom: t.id!=='v3' ? `2px solid ${on ? t.accent : 'transparent'}` : 'none',
              borderRadius: t.id==='v3' ? 8 : 0,
              padding: t.id==='v3' ? '8px 0' : '12px 0',
              color: on ? (t.id==='v3' ? t.fg : t.accent) : t.fgMuted,
              fontFamily: t.id==='v2' ? t.display : t.body,
              fontSize: t.id==='v3' ? 13 : 11, fontWeight: 700,
              letterSpacing: t.id==='v3' ? '-0.01em' : '0.15em',
              textTransform: t.id==='v3' ? 'none' : 'uppercase',
              textShadow: on && t.mode==='dark' && t.id!=='v3' ? `0 0 8px ${t.accentSoft}` : 'none',
              boxShadow: on && t.id==='v3' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>{l}</button>
          );
        })}
      </div>

      {tab === 'solo' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {SOLO_EX.map((ex, i) => <SoloExCard key={i} t={t} ex={ex} onPick={() => onPick(ex)} />)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {CHALLENGES.map((ch, i) => <ChallengeCard key={i} t={t} ch={ch} onPick={() => onPick(ch)} />)}
        </div>
      )}
    </div>
  );
}

function SoloExCard({ t, ex, onPick }) {
  const c = t.attr[ex.stat];
  return (
    <button onClick={onPick} style={{
      background: t.panel,
      border: `1px solid ${t.panelBorder}`, borderTop: t.id==='v3' ? `1px solid ${t.panelBorder}` : `2px solid ${c}`,
      borderRadius: t.radius,
      clipPath: t.id==='v2' ? t.cardClip : 'none',
      boxShadow: t.id==='v1' ? `0 0 10px ${t.accentSoft}` : t.panelGlow,
      padding: '14px 10px', cursor: 'pointer', display: 'flex',
      flexDirection: 'column', alignItems: t.id==='v3' ? 'flex-start' : 'center', gap: 6, textAlign: 'left',
      position: 'relative',
    }}>
      {t.id === 'v3' && (
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${c}1A`, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          <BoltIcon s={16} c={c} />
        </div>
      )}
      <span style={{ fontFamily: t.id==='v2' ? t.display : t.body, fontSize: t.id==='v3' ? 13 : 11, color: t.fg, fontWeight: 700, letterSpacing: t.id==='v3' ? '-0.01em' : '0.06em', textAlign: t.id==='v3' ? 'left' : 'center' }}>{ex.name}</span>
      <span style={{ fontFamily: t.mono, fontSize: 8, color: c, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{ex.stat}</span>
      <span style={{ fontFamily: t.id==='v3' ? t.body : t.mono, fontSize: 10, color: t.fgDim, letterSpacing: '0.04em' }}>Lv.{MOCK.level} · {ex.target}</span>
    </button>
  );
}

function ChallengeCard({ t, ch, onPick }) {
  const c = t.attr[ch.stat];
  return (
    <button onClick={onPick} style={{
      background: t.panel, border: `1px solid ${t.id==='v3' ? t.panelBorder : t.gold + '55'}`,
      borderLeft: t.id==='v3' ? `4px solid ${c}` : `3px solid ${t.gold}`,
      borderRadius: t.radius, clipPath: t.id==='v2' ? t.cardClip : 'none',
      boxShadow: t.id!=='v3' && t.mode==='dark' ? `0 0 16px ${t.goldSoft}` : t.panelGlow,
      padding: '16px 18px', cursor: 'pointer', textAlign: 'left',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: t.id==='v2' ? t.display : t.body, fontSize: t.id==='v3' ? 15 : 12, color: t.fg, fontWeight: 700, letterSpacing: t.id==='v3' ? '-0.01em' : '0.1em' }}>{ch.name}</span>
        <span style={{
          fontFamily: t.mono, fontSize: 9, color: c, padding: '3px 8px',
          border: t.id==='v3' ? 'none' : `1px solid ${c}`, background: t.id==='v3' ? `${c}1A` : 'transparent',
          borderRadius: t.id==='v3' ? 6 : 0, letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>{ch.stat}</span>
      </div>
      <span style={{ fontFamily: t.body, fontSize: 10, color: t.fgMuted, letterSpacing: '0.06em' }}>{ch.ex}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <StarIcon s={11} c={t.gold} sw={1} />
        <span style={{ fontFamily: t.mono, fontSize: 10, color: t.gold, letterSpacing: '0.08em' }}>+{ch.xp} XP reward</span>
      </div>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════
// PROFILE SCREEN
// ════════════════════════════════════════════════════════════════════
function ProfileScreen({ t }) {
  return (
    <div style={{ padding: '20px 14px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Identity panel */}
      <Panel t={t} style={{ padding: t.id==='v2' ? '36px 18px 22px' : '22px 18px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {/* avatar — sigil glyph */}
          <div style={{ position: 'relative' }}>
            {t.id === 'v3' ? (
              <div style={{
                width: 72, height: 72, borderRadius: 24,
                background: `linear-gradient(135deg, ${t.accent}33, ${t.gold}33)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1.5px solid ${t.panelBorder}`,
              }}>
                <span style={{ fontFamily: t.display, fontSize: 32, color: t.fg, fontWeight: 700 }}>A</span>
              </div>
            ) : (
              <DiamondGlyph s={68} c={t.accent} glow={t.mode==='dark' ? t.accent : ''} />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: t.display, fontSize: 22, color: t.fg, letterSpacing: t.id==='v3' ? '-0.01em' : '0.18em', fontWeight: 700 }}>{MOCK.name}</span>
            <button style={{ background: 'none', border: 'none', color: t.fgDim, cursor: 'pointer', padding: 4, fontFamily: t.body, fontSize: 14 }}>✎</button>
          </div>
          <RankBadge t={t} letter={MOCK.rank.letter} title={MOCK.rank.title} size="lg" />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: t.mono, fontSize: 9, color: t.fgDim, letterSpacing: '0.2em' }}>LEVEL</span>
            <span style={{ fontFamily: t.display, fontSize: 28, color: t.gold, fontWeight: 700, textShadow: t.mode==='dark' && t.id!=='v3' ? `0 0 14px ${t.gold}` : 'none', fontVariantNumeric: 'tabular-nums' }}>{MOCK.level}</span>
          </div>
          <div style={{ width: '100%' }}>
            <XpBar t={t} level={MOCK.level} pct={MOCK.pct} />
          </div>
          <span style={{ fontFamily: t.body, fontSize: 10, color: t.fgMuted, letterSpacing: t.id==='v3' ? 'normal' : '0.1em' }}>
            {t.id === 'v3' ? `${20 - MOCK.level} levels to ${MOCK.nextRank.letter}-rank` : `${20 - MOCK.level} LEVELS TO RANK ${MOCK.nextRank.letter}`}
          </span>
        </div>
      </Panel>

      {/* Attributes — radar chart */}
      <Panel t={t} style={{ padding: '18px 16px' }}>
        <SectionHead t={t} kicker="ANALYSIS" title={t.id==='v3' ? 'Attributes' : 'Attributes'} />
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
          <RadarChart t={t} attrs={MOCK.attrs} size={220} />
        </div>
      </Panel>

      {/* Stats row */}
      <Panel t={t} style={{ padding: '6px 18px' }}>
        <Stat t={t} label="Streak" value={<StreakFlame t={t} days={7} />} compact />
        <Divider t={t} />
        <Stat t={t} label={t.id==='v3' ? 'Total XP' : 'TOTAL XP'} value={MOCK.totalXP.toLocaleString()} valueColor={t.gold} />
        <Divider t={t} />
        <Stat t={t} label={t.id==='v3' ? 'Quests completed' : 'COMPLETED'} value={MOCK.totalCompleted} />
        <Divider t={t} />
        <Stat t={t} label={t.id==='v3' ? 'Joined' : 'JOINED'} value="14 days ago" valueColor={t.fgMuted} />
      </Panel>
    </div>
  );
}

function Stat({ t, label, value, valueColor, compact }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: compact ? '8px 0' : '12px 0' }}>
      <span style={{ fontFamily: t.body, fontSize: 11, color: t.fgMuted, letterSpacing: t.id==='v3' ? '0.01em' : '0.12em' }}>{label}</span>
      {typeof value === 'string' || typeof value === 'number' ? (
        <span style={{ fontFamily: t.mono, fontSize: 13, color: valueColor || t.fg, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>{value}</span>
      ) : value}
    </div>
  );
}
function Divider({ t }) {
  return <div style={{ height: 1, background: t.panelBorder, opacity: t.id==='v3' ? 1 : 0.5 }} />;
}

// ════════════════════════════════════════════════════════════════════
// RANKINGS SCREEN
// ════════════════════════════════════════════════════════════════════
function RankingsScreen({ t }) {
  const tiers = ['S','A','B','C','D','E'];
  return (
    <div style={{ padding: '20px 14px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        {t.id !== 'v3' && <span style={{ fontFamily: t.mono, fontSize: 9, color: t.fgDim, letterSpacing: '0.25em' }}>GLOBAL STANDINGS</span>}
        <h1 style={{ fontFamily: t.display, fontSize: t.id==='v3' ? 24 : 18, color: t.fg, letterSpacing: t.id==='v3' ? '-0.02em' : '0.15em', fontWeight: 700 }}>
          {t.id==='v3' ? 'Leaderboard' : 'RANKINGS'}
        </h1>
      </div>

      {tiers.map(tier => {
        const rows = LEADERBOARD[tier] || [];
        if (!rows.length) return null;
        return <RankSection key={tier} t={t} tier={tier} rows={rows} />;
      })}
    </div>
  );
}

function RankSection({ t, tier, rows }) {
  const c = t.rankTier[tier];
  const titleMap = { E:'Novice', D:'Apprentice', C:'Warrior', B:'Champion', A:'Hero', S:'Legend' };
  return (
    <Panel t={t} style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${t.panelBorder}` }}>
        {t.id === 'v3' ? (
          <span style={{ width: 28, height: 28, borderRadius: 10, background: `${c}1F`, color: c, fontFamily: t.display, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${c}` }}>{tier}</span>
        ) : (
          <HexBadge letter={tier} size={26} fg={c} borderColor={c} glow={t.mode==='dark' ? c : ''} bg={t.mode==='dark' ? '#00000055' : '#ffffff77'} />
        )}
        <span style={{ flex: 1, fontFamily: t.display, fontSize: 11, color: t.fg, letterSpacing: t.id==='v3' ? '-0.01em' : '0.18em', fontWeight: 700, textTransform: t.id==='v3' ? 'none' : 'uppercase' }}>
          {titleMap[tier]}
        </span>
        <span style={{ fontFamily: t.mono, fontSize: 9, color: t.fgDim, letterSpacing: '0.1em' }}>{rows.length} hunter{rows.length>1?'s':''}</span>
      </div>
      {rows.map((p, i) => <LeaderRow key={i} t={t} pos={i+1} p={p} />)}
    </Panel>
  );
}

function LeaderRow({ t, pos, p }) {
  const me = p.me;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
      borderBottom: `1px solid ${t.mode==='dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
      borderLeft: me ? `3px solid ${t.gold}` : '3px solid transparent',
      background: me ? t.goldSoft : 'transparent',
    }}>
      <span style={{ width: 18, fontFamily: t.mono, fontSize: 11, color: me ? t.gold : t.fgDim, textAlign: 'right', fontWeight: me ? 700 : 400 }}>{pos}</span>
      <span style={{ flex: 1, fontFamily: t.id==='v2' ? t.display : t.body, fontSize: 12, color: me ? t.gold : t.fg, fontWeight: me ? 700 : 500, letterSpacing: t.id==='v3' ? '-0.005em' : '0.06em' }}>
        {p.n}{me && <span style={{ marginLeft: 6, fontFamily: t.mono, fontSize: 8, color: t.gold, letterSpacing: '0.18em' }}>· YOU</span>}
      </span>
      <span style={{ fontFamily: t.mono, fontSize: 10, color: t.fgMuted, fontVariantNumeric: 'tabular-nums' }}>Lv.{p.lv}</span>
      <span style={{ fontFamily: t.mono, fontSize: 10, color: t.accent, minWidth: 58, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.xp.toLocaleString()} XP</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// TRIAL ACTIVE — rep counter
// ════════════════════════════════════════════════════════════════════
function TrialActiveScreen({ t, ex, onDone, onBack }) {
  const target = parseInt((ex && ex.target) || '42', 10) || 42;
  const [reps, setReps] = React.useState(8);
  const pct = Math.min(reps / target, 1);
  const allDone = reps >= target;

  return (
    <div style={{ padding: '20px 14px 100px', display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <div>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: t.fgMuted, fontFamily: t.body, fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
          <ChevronLeft s={12} c={t.fgMuted} /> {t.id==='v3' ? 'Back' : 'BACK'}
        </button>
        <h1 style={{ fontFamily: t.display, fontSize: t.id==='v3' ? 24 : 18, color: t.fg, letterSpacing: t.id==='v3' ? '-0.02em' : '0.18em', fontWeight: 700, marginTop: 6 }}>
          {ex?.name || 'Push-Ups'}
        </h1>
        <span style={{ fontFamily: t.mono, fontSize: 10, color: t.fgMuted, letterSpacing: '0.15em' }}>SET 1 / 3</span>
      </div>

      <Panel t={t} accent={allDone} style={{
        flex: 1, minHeight: 320, padding: 24,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
      }}>
        {/* Ring progress */}
        <div style={{ position: 'relative', width: 220, height: 220 }}>
          <svg width="220" height="220" viewBox="0 0 220 220" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="110" cy="110" r="98" stroke={t.mode==='dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} strokeWidth="6" fill="none" />
            <circle cx="110" cy="110" r="98"
              stroke={allDone ? t.success : t.gold} strokeWidth="6" fill="none"
              strokeLinecap={t.id==='v3' ? 'round' : 'butt'}
              strokeDasharray={2 * Math.PI * 98}
              strokeDashoffset={(1 - pct) * 2 * Math.PI * 98}
              style={{ transition: 'stroke-dashoffset 0.25s', filter: t.mode==='dark' ? `drop-shadow(0 0 8px ${allDone ? t.success : t.gold})` : 'none' }} />
            {/* tick marks every 10% (V1+V2) */}
            {t.id !== 'v3' && Array.from({ length: 20 }).map((_, i) => {
              const a = (i / 20) * 2 * Math.PI;
              const x1 = 110 + Math.cos(a) * 104, y1 = 110 + Math.sin(a) * 104;
              const x2 = 110 + Math.cos(a) * 108, y2 = 110 + Math.sin(a) * 108;
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={t.fgDim} strokeWidth="1" />;
            })}
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <span key={reps} style={{
              fontFamily: t.display, fontSize: 64, fontWeight: 700, color: allDone ? t.success : t.gold,
              lineHeight: 1, fontVariantNumeric: 'tabular-nums',
              textShadow: t.mode==='dark' && t.id!=='v3' ? `0 0 18px ${allDone ? t.success : t.gold}` : 'none',
              animation: 'arBump 0.18s ease-out',
            }}>{reps}</span>
            <span style={{ fontFamily: t.mono, fontSize: 14, color: t.fgMuted, fontVariantNumeric: 'tabular-nums' }}>/ {target}</span>
            <span style={{ fontFamily: t.mono, fontSize: 9, color: t.fgDim, letterSpacing: '0.25em', marginTop: 6 }}>{allDone ? 'COMPLETE' : 'TAP TO COUNT'}</span>
          </div>
        </div>

        <button onClick={() => setReps(r => Math.min(target, r + 1))} style={{
          width: '100%', padding: '18px 0',
          background: allDone ? t.success : (t.id === 'v3' ? t.gold : 'transparent'),
          color: t.id==='v3' ? '#1A0E00' : (allDone ? t.success : t.gold),
          border: `1.5px solid ${allDone ? t.success : t.gold}`,
          borderRadius: t.id==='v3' ? 999 : t.radius,
          clipPath: t.id==='v2' ? 'polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%)' : 'none',
          fontFamily: t.id==='v2' ? t.display : t.body, fontSize: 13, fontWeight: 700,
          letterSpacing: t.id==='v3' ? '0' : '0.2em',
          textTransform: t.id==='v3' ? 'none' : 'uppercase',
          boxShadow: t.mode==='dark' ? `0 0 16px ${allDone ? t.success : t.gold}55` : 'none',
          cursor: 'pointer',
        }}>{allDone ? (t.id==='v3' ? 'Finish set' : 'FINISH SET') : (t.id==='v3' ? 'Count rep' : '+1 REP')}</button>
      </Panel>

      <Btn t={t} variant="secondary" onClick={onBack}>{t.id==='v3' ? 'Abandon' : 'ABANDON'}</Btn>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// MODAL (rank-up / penalty)
// ════════════════════════════════════════════════════════════════════
function Modal({ t, kind, onClose }) {
  if (!kind) return null;
  const isUp = kind === 'rankup';
  const accent = isUp ? t.gold : t.danger;
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: t.mode==='dark' ? 'rgba(5, 8, 15, 0.86)' : 'rgba(255, 255, 255, 0.86)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      backdropFilter: 'blur(6px)',
      animation: 'arFade 0.22s ease-out',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        position: 'relative',
        width: '100%', maxWidth: 320,
        background: t.panel,
        border: `1.5px solid ${accent}`,
        boxShadow: `0 0 40px ${accent}66, ${t.panelGlow}`,
        clipPath: t.id==='v2' ? t.cardClip : 'none',
        borderRadius: t.radius,
        padding: t.id==='v2' ? '40px 20px 28px' : '32px 20px 24px',
        textAlign: 'center',
        animation: 'arPop 0.32s cubic-bezier(.2,1.6,.4,1)',
      }}>
        {t.id !== 'v3' && <Corners color={accent} />}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          {isUp ? (
            <HexBadge letter={MOCK.nextRank.letter} size={68} fg={accent} borderColor={accent} glow={t.mode==='dark' ? accent : ''} bg={t.mode==='dark' ? '#00000055' : '#ffffff77'} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: `${accent}22`, border: `2px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CloseIcon s={28} c={accent} sw={2.5} />
            </div>
          )}
        </div>
        <div style={{ display: 'inline-block', padding: '4px 14px', borderTop: t.id!=='v3' ? `1px solid ${accent}` : 'none', borderBottom: t.id!=='v3' ? `1px solid ${accent}` : 'none', marginBottom: 14 }}>
          <span style={{ fontFamily: t.display, fontSize: 13, color: accent, letterSpacing: t.id==='v3' ? '-0.01em' : '0.25em', fontWeight: 700, textTransform: t.id==='v3' ? 'none' : 'uppercase', textShadow: t.mode==='dark' && t.id!=='v3' ? `0 0 12px ${accent}` : 'none' }}>
            {isUp ? (t.id==='v3' ? 'Rank up' : 'Rank Up') : (t.id==='v3' ? 'Penalty' : 'Penalty')}
          </span>
        </div>
        <p style={{ fontFamily: t.body, fontSize: 12, color: t.fg, lineHeight: 1.6, margin: 0, letterSpacing: t.id==='v3' ? 'normal' : '0.05em' }}>
          {isUp
            ? <>You have ascended to <strong style={{ color: accent }}>{MOCK.nextRank.letter}-rank Champion</strong>. The system acknowledges your strength.</>
            : <>2 objectives went unfinished yesterday. <strong style={{ color: accent }}>−30 XP</strong>. Streak reset.</>}
        </p>
        <div style={{ marginTop: 18 }}>
          <Btn t={t} variant={isUp ? 'gold' : 'secondary'} onClick={onClose}>{t.id==='v3' ? 'Continue' : 'CONTINUE'}</Btn>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  HomeScreen, TrialScreen, ProfileScreen, RankingsScreen, TrialActiveScreen, Modal,
  MOCK_QUESTS_INIT, MOCK,
});
