// Icons used across all three variants. Stroke-based; size + color via props.
const Icon = ({ d, s = 18, c = 'currentColor', sw = 1.5, viewBox = '0 0 24 24', fill = 'none' }) => (
  <svg width={s} height={s} viewBox={viewBox} fill={fill} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

const HomeIcon  = (p) => <Icon {...p} d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />;
const SwordIcon = (p) => <Icon {...p} d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M15 5l4-4 2 2-4 4" />;
const CrownIcon = (p) => <Icon {...p} d="M3 18h18M3 18l1-9 5 4 3-7 3 7 5-4 1 9" />;
const ShieldIcon = (p) => <Icon {...p} d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5l8-3z M9 12l2 2 4-4" />;
const BoltIcon = (p) => <Icon {...p} d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />;
const FlameIcon = (p) => <Icon {...p} d="M12 2c1 4 4 5 4 9a4 4 0 11-8 0c0-2 1-3 2-4-1 3 1 4 2 3 0-3-2-5 0-8z" />;
const ChevronRight = (p) => <Icon {...p} d="M9 5l7 7-7 7" />;
const ChevronLeft = (p) => <Icon {...p} d="M15 5l-7 7 7 7" />;
const PlusIcon = (p) => <Icon {...p} d="M12 5v14M5 12h14" />;
const MinusIcon = (p) => <Icon {...p} d="M5 12h14" />;
const CheckIcon = (p) => <Icon {...p} d="M5 12l5 5 9-11" />;
const StarIcon = (p) => <Icon {...p} d="M12 2l3 7 7 .5-5.5 4.5 2 7L12 17l-6.5 4 2-7L2 9.5 9 9l3-7z" />;
const ClockIcon = (p) => <Icon {...p} d="M12 7v5l3 2 M12 22a10 10 0 100-20 10 10 0 000 20z" />;
const RuneIcon = (p) => <Icon {...p} d="M12 2l10 10-10 10L2 12 12 2zM12 7v10M8 12h8" />;
const CloseIcon = (p) => <Icon {...p} d="M6 6l12 12M18 6L6 18" />;
const PlayIcon = (p) => <Icon {...p} d="M6 4l14 8-14 8V4z" fill="currentColor" />;

// Glyph for daily-quest "system" alert (triangle inside circle)
const SystemSigil = ({ s = 28, c = 'currentColor' }) => (
  <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="14" stroke={c} strokeWidth="1.5" />
    <path d="M16 7L25 23H7L16 7z" stroke={c} strokeWidth="1.5" fill="none" />
    <circle cx="16" cy="19" r="1.5" fill={c} />
  </svg>
);

// Faceted diamond glyph — Arium 'A' echo (used by V2)
const DiamondGlyph = ({ s = 32, c = 'currentColor', glow = '' }) => (
  <svg width={s} height={s * 1.15} viewBox="0 0 40 46" fill="none">
    {glow && <path d="M20 2L38 16L30 44H10L2 16L20 2z" stroke={glow} strokeWidth="3" opacity="0.4" />}
    <path d="M20 2L38 16L30 44H10L2 16L20 2z" stroke={c} strokeWidth="1.5" />
    <path d="M20 2L20 44M2 16L38 16M10 44L20 16L30 44" stroke={c} strokeWidth="0.8" opacity="0.6" />
    <path d="M16 8L24 8L20 16L16 8z" fill={c} opacity="0.3" />
  </svg>
);

// Hex rank badge — used by all three but styled per-variant via props
const HexBadge = ({ letter = 'C', size = 60, fg = '#fff', bg = 'transparent', borderColor = '#fff', glow = '' }) => {
  const w = size;
  const h = size * 1.155;
  return (
    <svg width={w} height={h} viewBox="0 0 60 70" style={{ filter: glow ? `drop-shadow(0 0 12px ${glow})` : 'none' }}>
      <polygon points="30,2 56,17 56,53 30,68 4,53 4,17" fill={bg} stroke={borderColor} strokeWidth="1.5" />
      <polygon points="30,8 51,20 51,50 30,62 9,50 9,20" fill="none" stroke={borderColor} strokeWidth="0.5" opacity="0.4" />
      <text x="30" y="44" textAnchor="middle" fontSize="28" fontWeight="700" fill={fg} fontFamily="inherit" letterSpacing="-0.02em">{letter}</text>
    </svg>
  );
};

Object.assign(window, {
  HomeIcon, SwordIcon, CrownIcon, ShieldIcon, BoltIcon, FlameIcon,
  ChevronRight, ChevronLeft, PlusIcon, MinusIcon, CheckIcon, StarIcon,
  ClockIcon, RuneIcon, CloseIcon, PlayIcon,
  SystemSigil, DiamondGlyph, HexBadge,
});
