// Visual widgets — each takes the active `t` theme and renders the variant-appropriate look.
// Variants are switched on `t.id` ('v1' | 'v2' | 'v3').

// ─── Panel ──────────────────────────────────────────────────────────
// Wrapper "card" surface. V1 = bracketed HUD, V2 = faceted gem, V3 = soft rounded.
function Panel({ t, children, style = {}, glowColor, accent = false, ...rest }) {
  const baseGlow = glowColor ? `0 0 24px ${glowColor}, ${t.panelGlow}` : t.panelGlow;
  if (t.id === 'v1') {
    return (
      <div style={{
        position: 'relative',
        background: t.panel,
        border: `1px solid ${accent ? t.accent : t.panelBorder}`,
        boxShadow: accent ? `0 0 22px ${t.accentSoft}, ${baseGlow}` : baseGlow,
        backdropFilter: 'blur(8px)',
        ...style,
      }} {...rest}>
        {/* HUD bracket corners */}
        <Corners color={accent ? t.accent : t.panelBorder} />
        {/* subtle scanline */}
        {t.mode === 'dark' && <div style={{ position: 'absolute', inset: 0, background: t.scanline, pointerEvents: 'none', mixBlendMode: 'screen' }} />}
        <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      </div>
    );
  }
  if (t.id === 'v2') {
    return (
      <div style={{
        position: 'relative',
        background: t.panel,
        border: `1px solid ${accent ? t.accent : t.panelBorder}`,
        boxShadow: accent ? `0 0 32px rgba(155,140,255,0.3), ${baseGlow}` : baseGlow,
        clipPath: t.cardClip,
        ...style,
      }} {...rest}>
        {/* faceted highlights */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: t.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 30%, transparent 70%, rgba(180,140,255,0.05) 100%)'
            : 'linear-gradient(135deg, rgba(110,80,220,0.04) 0%, transparent 50%)',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      </div>
    );
  }
  // v3
  return (
    <div style={{
      background: t.panel,
      border: `1px solid ${accent ? t.accent : t.panelBorder}`,
      borderRadius: t.radius,
      boxShadow: t.panelGlow,
      ...style,
    }} {...rest}>
      {children}
    </div>
  );
}

function Corners({ color }) {
  const arm = { position: 'absolute', width: 10, height: 10, borderColor: color, borderStyle: 'solid' };
  return (
    <>
      <div style={{ ...arm, top: -1, left: -1, borderWidth: '1px 0 0 1px' }} />
      <div style={{ ...arm, top: -1, right: -1, borderWidth: '1px 1px 0 0' }} />
      <div style={{ ...arm, bottom: -1, left: -1, borderWidth: '0 0 1px 1px' }} />
      <div style={{ ...arm, bottom: -1, right: -1, borderWidth: '0 1px 1px 0' }} />
    </>
  );
}

// ─── XP Bar ─────────────────────────────────────────────────────────
function XpBar({ t, level, pct, animate = true, height }) {
  const [w, setW] = React.useState(animate ? 0 : pct);
  React.useEffect(() => {
    if (!animate) { setW(pct); return; }
    const id = setTimeout(() => setW(pct), 80);
    return () => clearTimeout(id);
  }, [pct, animate]);
  const h = height || (t.id === 'v3' ? 8 : 16);

  if (t.id === 'v1') {
    return (
      <div style={{ position: 'relative', height: h, background: 'rgba(0,0,0,0.55)', border: `1px solid ${t.gold}`, boxShadow: `0 0 10px ${t.goldSoft}, inset 0 0 8px rgba(0,0,0,0.6)` }}>
        <div style={{
          width: `${w}%`, height: '100%',
          background: `linear-gradient(90deg, #E0A800, ${t.gold})`,
          boxShadow: `0 0 14px ${t.gold}`,
          transition: 'width 0.9s cubic-bezier(.2,.7,.2,1)',
        }} />
        {/* level tick marks */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
          {[20, 40, 60, 80].map((p) => (
            <div key={p} style={{ position: 'absolute', left: `${p}%`, top: 2, bottom: 2, width: 1, background: 'rgba(0,0,0,0.4)' }} />
          ))}
        </div>
        <span style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontFamily: t.mono, color: t.mode === 'dark' ? '#1A0E00' : '#2A1500', fontWeight: 700, letterSpacing: '0.1em',
        }}>LV.{level} — {pct}%</span>
      </div>
    );
  }
  if (t.id === 'v2') {
    return (
      <div style={{ position: 'relative' }}>
        <div style={{
          height: h, background: 'rgba(0,0,0,0.4)',
          border: `1px solid ${t.gold}`,
          clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 8px 100%, 0 50%)',
          padding: 2,
        }}>
          <div style={{
            width: `${w}%`, height: '100%',
            background: `linear-gradient(90deg, ${t.violet || t.accent}, ${t.gold})`,
            clipPath: 'polygon(6px 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 6px 100%, 0 50%)',
            transition: 'width 1s cubic-bezier(.2,.7,.2,1)',
            boxShadow: `0 0 18px ${t.gold}`,
          }} />
        </div>
        <span style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontFamily: t.display, color: t.mode === 'dark' ? '#1A0840' : '#1A0840', fontWeight: 700, letterSpacing: '0.15em',
        }}>LV.{level} · {pct}%</span>
      </div>
    );
  }
  // v3 — clean rounded with label above
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, color: t.fgMuted, letterSpacing: '0.02em' }}>
        <span>Level {level}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pct}% to {level + 1}</span>
      </div>
      <div style={{ height: h, background: t.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', borderRadius: h/2, overflow: 'hidden' }}>
        <div style={{
          width: `${w}%`, height: '100%',
          background: `linear-gradient(90deg, ${t.gold}, ${t.accent})`,
          borderRadius: h/2,
          transition: 'width 1s cubic-bezier(.2,.7,.2,1)',
        }} />
      </div>
    </div>
  );
}

// ─── Radar Chart (Attributes) ───────────────────────────────────────
function RadarChart({ t, attrs, size = 200 }) {
  const labels = [
    { key: 'strength',  name: 'STR' },
    { key: 'core',      name: 'COR' },
    { key: 'power',     name: 'POW' },
    { key: 'endurance', name: 'END' },
  ];
  const cx = size / 2, cy = size / 2;
  const r = size * 0.36;
  const max = 30; // soft cap for visual
  // 4 axes — top, right, bottom, left
  const angles = [-Math.PI/2, 0, Math.PI/2, Math.PI];
  const pt = (i, mag) => [cx + Math.cos(angles[i]) * r * mag, cy + Math.sin(angles[i]) * r * mag];

  const dataPts = labels.map((l, i) => pt(i, Math.min(attrs[l.key] / max, 1)));
  const dataD = 'M' + dataPts.map(p => p.join(',')).join(' L') + ' Z';

  const rings = t.id === 'v1' ? [0.25, 0.5, 0.75, 1] : t.id === 'v2' ? [0.33, 0.66, 1] : [0.5, 1];

  const stroke = t.accent;
  const fillColor = t.id === 'v3' ? t.accentSoft : `${t.accent}33`;
  const labelFont = t.id === 'v2' ? t.display : t.mono;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      {/* grid rings */}
      {rings.map((mag, i) => (
        <polygon key={i}
          points={labels.map((_, j) => pt(j, mag).join(',')).join(' ')}
          fill="none" stroke={t.fgDim} strokeWidth={0.6} strokeDasharray={t.id==='v1' && i < rings.length-1 ? '2 3' : ''}
        />
      ))}
      {/* axes */}
      {labels.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={t.fgDim} strokeWidth={0.6} />;
      })}
      {/* data polygon */}
      <path d={dataD} fill={fillColor} stroke={stroke} strokeWidth={1.5} strokeLinejoin="miter"
        style={{ filter: t.mode === 'dark' && t.id !== 'v3' ? `drop-shadow(0 0 8px ${t.accent})` : 'none' }} />
      {/* per-attr dots */}
      {labels.map((l, i) => {
        const [x, y] = pt(i, Math.min(attrs[l.key] / max, 1));
        return <circle key={i} cx={x} cy={y} r={3} fill={t.attr[l.key]} stroke={t.bg} strokeWidth={1} />;
      })}
      {/* labels */}
      {labels.map((l, i) => {
        const [x, y] = pt(i, 1.22);
        return (
          <g key={l.key} fontFamily={labelFont} textAnchor="middle">
            <text x={x} y={y + 4} fontSize={9} fill={t.fgMuted} letterSpacing="0.15em">{l.name}</text>
            <text x={x} y={y + 16} fontSize={13} fontWeight={700} fill={t.attr[l.key]}>{attrs[l.key]}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Streak Flame ───────────────────────────────────────────────────
function StreakFlame({ t, days }) {
  const heat = Math.min(days / 14, 1);
  // colors fade from cool→hot as streak builds
  const c1 = days < 3 ? t.accent : days < 7 ? t.gold : '#FF6E3F';
  const c2 = days < 3 ? '#5BCBFB' : days < 7 ? t.gold : '#FF3D6B';

  if (t.id === 'v1') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="32" height="36" viewBox="0 0 32 36" style={{ filter: `drop-shadow(0 0 8px ${c1})` }}>
          <polygon points="16,2 28,9 28,27 16,34 4,27 4,9" fill="none" stroke={c1} strokeWidth="1.2" />
          <path d="M16 9c1.5 4 5 4.5 5 9a5 5 0 11-10 0c0-2 1.5-3.5 2.5-4.5-1 3 1.5 4 2.5 3 0-3-2-5 0-7.5z" fill={c2} opacity={0.85 + heat * 0.15} />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <span style={{ fontFamily: t.mono, fontSize: 18, fontWeight: 700, color: c1, lineHeight: 1, textShadow: `0 0 12px ${c1}` }}>{days}</span>
          <span style={{ fontFamily: t.mono, fontSize: 8, color: t.fgMuted, letterSpacing: '0.15em', marginTop: 2 }}>DAY STREAK</span>
        </div>
      </div>
    );
  }
  if (t.id === 'v2') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg width="36" height="42" viewBox="0 0 36 42" style={{ filter: `drop-shadow(0 0 10px ${c1})` }}>
          {/* gem-shard */}
          <path d="M18 2L32 14L26 40H10L4 14L18 2z" fill={`${c1}22`} stroke={c1} strokeWidth="1.2" />
          <path d="M18 2L18 40M4 14L32 14M10 40L18 14L26 40" stroke={c1} strokeWidth="0.6" opacity="0.6" />
          <path d="M18 14c2 5 6 5 6 11a6 6 0 01-12 0c0-3 2-4 3-5-1 3 2 4 3 3 0-4-2-5 0-9z" fill={c2} />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontFamily: t.display, fontSize: 22, fontWeight: 700, color: c1, lineHeight: 1, letterSpacing: '0.05em' }}>{days}</span>
          <span style={{ fontFamily: t.body, fontSize: 9, color: t.fgMuted, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Day Streak</span>
        </div>
      </div>
    );
  }
  // v3 - simple chip
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: `${c1}1A`, borderRadius: 999 }}>
      <svg width="16" height="18" viewBox="0 0 16 18" fill={c2}>
        <path d="M8 1c1 3 4 4 4 8a4 4 0 11-8 0c0-2 1-3 2-4-1 3 1 4 2 3 0-3-2-5 0-7z" />
      </svg>
      <span style={{ fontFamily: t.body, fontSize: 13, fontWeight: 600, color: t.fg, fontVariantNumeric: 'tabular-nums' }}>{days}</span>
      <span style={{ fontFamily: t.body, fontSize: 11, color: t.fgMuted }}>day streak</span>
    </div>
  );
}

// ─── Rank Badge ─────────────────────────────────────────────────────
function RankBadge({ t, letter, title, size = 'md' }) {
  const c = t.rankTier[letter] || t.accent;
  const sz = size === 'lg' ? 64 : size === 'sm' ? 28 : 44;

  if (t.id === 'v3') {
    // minimalist: just a colored letter chip
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: sz * 0.7, height: sz * 0.7, borderRadius: t.radius,
          background: `${c}1F`, color: c, fontFamily: t.display, fontWeight: 700,
          fontSize: sz * 0.4, display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1.5px solid ${c}`,
        }}>{letter}</span>
        {title && <span style={{ fontSize: sz * 0.22, color: t.fgMuted, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: t.body }}>{title}</span>}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <HexBadge letter={letter} size={sz} fg={c} borderColor={c} glow={t.mode === 'dark' ? c : ''} bg={t.mode === 'dark' ? '#00000055' : '#ffffff77'} />
      {title && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 9, color: t.fgDim, fontFamily: t.mono, letterSpacing: '0.2em' }}>RANK</span>
          <span style={{ fontSize: 12, color: c, fontFamily: t.display, letterSpacing: '0.15em', fontWeight: 700, textTransform: 'uppercase' }}>{title}</span>
        </div>
      )}
    </div>
  );
}

// ─── Bottom Nav (in-frame) ──────────────────────────────────────────
function BottomNav({ t, active, onNav }) {
  const items = [
    { k: 'home',     I: HomeIcon,  L: 'Home' },
    { k: 'trial',    I: SwordIcon, L: 'Trials' },
    { k: 'rank',     I: CrownIcon, L: 'Ranks' },
    { k: 'profile',  I: ShieldIcon, L: 'Profile' },
  ];
  const baseBg = t.id === 'v3'
    ? t.mode === 'dark' ? 'rgba(11,11,14,0.92)' : 'rgba(255,255,255,0.92)'
    : t.mode === 'dark' ? 'rgba(6,8,15,0.92)' : 'rgba(255,255,255,0.92)';
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      background: baseBg,
      backdropFilter: 'blur(14px)',
      borderTop: `1px solid ${t.panelBorder}`,
      padding: t.id === 'v3' ? '10px 4px 14px' : '8px 4px 12px',
      display: 'flex', justifyContent: 'space-around',
      boxShadow: t.id === 'v3' ? 'none' : `0 -8px 24px ${t.accentSoft}`,
    }}>
      {items.map(({ k, I, L }) => {
        const on = active === k;
        const color = on ? t.accent : t.fgDim;
        return (
          <button key={k} onClick={() => onNav(k)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            color, fontFamily: t.id === 'v2' ? t.display : t.body,
            fontSize: 9, letterSpacing: t.id === 'v3' ? '0.02em' : '0.18em',
            textTransform: 'uppercase', padding: '6px 14px',
            position: 'relative',
            transition: 'color 0.2s',
          }}>
            {on && t.id === 'v1' && <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', width: 18, height: 2, background: t.accent, boxShadow: `0 0 6px ${t.accent}` }} />}
            {on && t.id === 'v3' && <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: t.accent }} />}
            <I s={22} c={color} sw={on ? 2 : 1.5} />
            <span style={{ fontWeight: on ? 700 : 500 }}>{L}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Pill button & misc ─────────────────────────────────────────────
function Btn({ t, children, onClick, variant = 'primary', style = {} }) {
  const colors = {
    primary:   { bg: t.id === 'v3' ? t.accent : 'transparent', border: t.accent, fg: t.id === 'v3' ? (t.mode==='dark'?'#0B0B0E':'#fff') : t.accent, shadow: t.accentSoft },
    gold:      { bg: t.id === 'v3' ? t.gold   : 'transparent', border: t.gold,   fg: t.id === 'v3' ? '#1A0E00' : t.gold,   shadow: t.goldSoft },
    secondary: { bg: 'transparent', border: t.panelBorder, fg: t.fgMuted, shadow: 'transparent' },
  }[variant];
  return (
    <button onClick={onClick} style={{
      background: colors.bg, border: `1px solid ${colors.border}`, color: colors.fg,
      fontFamily: t.id === 'v2' ? t.display : t.body, fontSize: 12, fontWeight: 700,
      letterSpacing: t.id === 'v3' ? '0.02em' : '0.18em',
      textTransform: t.id === 'v3' ? 'none' : 'uppercase',
      padding: t.id === 'v3' ? '14px 22px' : '13px 22px',
      borderRadius: t.id === 'v3' ? 999 : t.radius,
      clipPath: t.id === 'v2' ? 'polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)' : 'none',
      boxShadow: variant !== 'secondary' && t.mode === 'dark' ? `0 0 14px ${colors.shadow}` : 'none',
      cursor: 'pointer', width: '100%', transition: 'transform 0.1s, box-shadow 0.2s',
    }}>{children}</button>
  );
}

// ─── Section heading (per-variant) ──────────────────────────────────
function SectionHead({ t, kicker, title, right }) {
  if (t.id === 'v3') {
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '6px 2px' }}>
        <h3 style={{ fontFamily: t.display, fontSize: 18, color: t.fg, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</h3>
        {right}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '4px 2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 4, height: 14, background: t.accent, boxShadow: `0 0 8px ${t.accent}` }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {kicker && <span style={{ fontFamily: t.mono, fontSize: 8, color: t.fgDim, letterSpacing: '0.25em' }}>{kicker}</span>}
          <span style={{ fontFamily: t.display, fontSize: 12, color: t.accent, letterSpacing: '0.22em', fontWeight: 700, textTransform: 'uppercase', textShadow: t.mode==='dark' ? `0 0 8px ${t.accentSoft}` : 'none' }}>{title}</span>
        </div>
      </div>
      {right}
    </div>
  );
}

Object.assign(window, { Panel, XpBar, RadarChart, StreakFlame, RankBadge, BottomNav, Btn, SectionHead, Corners });
