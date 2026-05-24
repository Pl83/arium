// App: composes the screens inside an Android frame, with bottom-tab navigation.
// `theme` (the active token set) is passed down to all screens.

function AriumApp({ theme: t, label }) {
  const [tab, setTab] = React.useState('home');
  const [quests, setQuests] = React.useState(() => MOCK_QUESTS_INIT.map(q => ({ ...q })));
  const [modal, setModal] = React.useState(null);
  const [activeEx, setActiveEx] = React.useState(null);

  const toggle = (i) => {
    setQuests(qs => qs.map((q, j) => j === i ? { ...q, cur: q.cur >= q.max ? 0 : q.max } : q));
  };

  const navigate = (k) => {
    if (k === 'trial' && activeEx) setActiveEx(null);
    setTab(k);
  };

  let content;
  if (activeEx) {
    content = <TrialActiveScreen t={t} ex={activeEx} onBack={() => setActiveEx(null)} onDone={() => setActiveEx(null)} />;
  } else if (tab === 'home') {
    content = <HomeScreen t={t} quests={quests} onToggleQuest={toggle} onShowRankUp={() => setModal('rankup')} onShowPenalty={() => setModal('penalty')} />;
  } else if (tab === 'trial') {
    content = <TrialScreen t={t} onPick={setActiveEx} />;
  } else if (tab === 'rank') {
    content = <RankingsScreen t={t} />;
  } else if (tab === 'profile') {
    content = <ProfileScreen t={t} />;
  }

  return (
    <div data-screen-label={label} style={{
      position: 'relative',
      width: '100%', height: '100%',
      background: t.bg, color: t.fg,
      fontFamily: t.body,
      overflow: 'hidden',
      letterSpacing: t.id === 'v3' ? '0' : '0.02em',
    }}>
      {/* radial backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: t.bgGrad, pointerEvents: 'none' }} />
      {/* vignette */}
      {t.vignette !== 'none' && <div style={{ position: 'absolute', inset: 0, background: t.vignette, pointerEvents: 'none' }} />}
      {/* scrollable content */}
      <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        {content}
      </div>
      {/* bottom nav (above content) */}
      <BottomNav t={t} active={activeEx ? 'trial' : tab} onNav={navigate} />
      {/* modal */}
      <Modal t={t} kind={modal} onClose={() => setModal(null)} />
    </div>
  );
}

// Wraps the app in an Android device bezel.
function AriumDevice({ theme }) {
  return (
    <div style={{
      width: 380, height: 760, borderRadius: 36,
      background: theme.mode === 'dark' ? '#000' : '#E5E7EB',
      border: `9px solid ${theme.mode === 'dark' ? '#0d0d12' : '#CBD5E1'}`,
      boxShadow: theme.mode === 'dark'
        ? '0 40px 100px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05)'
        : '0 30px 80px rgba(0,0,0,0.18)',
      overflow: 'hidden',
      position: 'relative',
      boxSizing: 'border-box',
    }}>
      {/* status bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 22px', fontFamily: theme.body, fontSize: 11, color: theme.fg, zIndex: 5,
      }}>
        <span style={{ fontFamily: theme.mono, fontWeight: 600, letterSpacing: '0.02em' }}>9:30</span>
        {/* notch */}
        <div style={{
          position: 'absolute', left: '50%', top: 8, transform: 'translateX(-50%)',
          width: 18, height: 18, borderRadius: '50%', background: '#000',
          border: '1px solid rgba(255,255,255,0.05)',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* signal */}
          <svg width="14" height="10" viewBox="0 0 14 10"><path d="M0 8h2v2H0zM4 5h2v5H4zM8 2h2v8H8zM12 0h2v10h-2z" fill={theme.fg} opacity="0.9"/></svg>
          {/* wifi */}
          <svg width="14" height="10" viewBox="0 0 14 10"><path d="M7 9.5L0 4.5a10 10 0 0114 0L7 9.5z" fill={theme.fg} opacity="0.9"/></svg>
          {/* battery */}
          <svg width="22" height="11" viewBox="0 0 22 11"><rect x="0.5" y="0.5" width="18" height="10" rx="2" stroke={theme.fg} strokeOpacity="0.9" fill="none"/><rect x="2" y="2" width="13" height="7" rx="1" fill={theme.fg} opacity="0.9"/><rect x="19.5" y="3" width="2" height="5" rx="0.5" fill={theme.fg} opacity="0.9"/></svg>
        </div>
      </div>
      <div style={{ position: 'absolute', top: 28, left: 0, right: 0, bottom: 0 }}>
        <AriumApp theme={theme} label={theme.name} />
      </div>
      {/* gesture nav pill */}
      <div style={{
        position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
        width: 110, height: 4, borderRadius: 2, background: theme.fg, opacity: 0.35,
      }} />
    </div>
  );
}

Object.assign(window, { AriumApp, AriumDevice });
