/**
 * Kirimin artwork — one recurring motif: a road that bends through a Bali landscape
 * with a pickup pin, a drop-off pin and a scooter already heading the same way.
 * That is the product ("titip ke yang searah"), so it is what the banners show.
 *
 * Pure react-native-svg, sized by width/height, no external assets.
 */
import React from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { colors } from '../theme/tokens';

type Tone = 'kirim' | 'angkut';

const TONES: Record<Tone, { skyTop: string; skyBottom: string; hillBack: string; hillFront: string; pinA: string; pinB: string }> = {
  kirim: {
    skyTop: colors.laut,
    skyBottom: colors.primary,
    hillBack: '#2F6FE8',
    hillFront: '#1D56CC',
    pinA: '#FFFFFF',
    pinB: colors.senja,
  },
  angkut: {
    skyTop: '#064E3B',
    skyBottom: colors.sawah,
    hillBack: '#13B07C',
    hillFront: '#0C8A60',
    pinA: '#FFFFFF',
    pinB: colors.kunyit,
  },
};

function Pin({ x, y, color, ring }: { x: number; y: number; color: string; ring: string }) {
  return (
    <G>
      <Ellipse cx={x} cy={y + 2} rx={7} ry={2.4} fill="#000" opacity={0.18} />
      <Path
        d={`M${x} ${y} C ${x - 10} ${y - 12}, ${x - 10} ${y - 24}, ${x} ${y - 26} C ${x + 10} ${y - 24}, ${x + 10} ${y - 12}, ${x} ${y} Z`}
        fill={color}
      />
      <Circle cx={x} cy={y - 16} r={4} fill={ring} />
    </G>
  );
}

function Scooter({ x, y, box }: { x: number; y: number; box: string }) {
  // Tiny side-view scooter with a delivery box, ~34px wide.
  return (
    <G transform={`translate(${x} ${y})`}>
      <Rect x={-2} y={-22} width={13} height={11} rx={2.5} fill={box} />
      <Rect x={2} y={-18} width={5} height={2} rx={1} fill="#FFFFFF" opacity={0.7} />
      <Path d="M 0 -10 L 22 -10 L 27 -20 L 30 -20 L 25 -6 L 2 -6 Z" fill="#FFFFFF" />
      <Circle cx={22} cy={-26} r={4.5} fill={colors.kunyit} />
      <Path d="M 18 -21 L 26 -21 L 24 -12 L 16 -12 Z" fill={colors.laut} />
      <Circle cx={4} cy={-3} r={5} fill={colors.laut} />
      <Circle cx={4} cy={-3} r={2} fill="#FFFFFF" />
      <Circle cx={26} cy={-3} r={5} fill={colors.laut} />
      <Circle cx={26} cy={-3} r={2} fill="#FFFFFF" />
    </G>
  );
}

/**
 * Wide landscape banner. Designed on a 360×150 canvas; scales to any size.
 * Use as the background of a hero card (absolute-fill) or standalone.
 */
export function SearahScene({
  width = 360,
  height = 150,
  tone = 'kirim',
  showScooter = true,
}: {
  width?: number;
  height?: number;
  tone?: Tone;
  showScooter?: boolean;
}) {
  const t = TONES[tone];
  const id = `sky-${tone}`;
  return (
    <Svg width={width} height={height} viewBox="0 0 360 150" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={t.skyTop} />
          <Stop offset="1" stopColor={t.skyBottom} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={360} height={150} fill={`url(#${id})`} />
      {/* Sun */}
      <Circle cx={300} cy={38} r={26} fill={colors.kunyit} opacity={0.25} />
      <Circle cx={300} cy={38} r={16} fill={colors.kunyit} />
      {/* Hills */}
      <Path d="M0 96 C 60 70, 110 78, 160 92 C 210 106, 260 70, 360 84 L 360 150 L 0 150 Z" fill={t.hillBack} />
      <Path d="M0 116 C 70 98, 130 104, 190 114 C 250 124, 300 104, 360 108 L 360 150 L 0 150 Z" fill={t.hillFront} />
      {/* Road */}
      <Path
        d="M -10 140 C 70 132, 110 104, 180 108 C 250 112, 280 86, 370 80"
        stroke="#FFFFFF"
        strokeWidth={14}
        strokeLinecap="round"
        fill="none"
        opacity={0.95}
      />
      <Path
        d="M -10 140 C 70 132, 110 104, 180 108 C 250 112, 280 86, 370 80"
        stroke={colors.kunyit}
        strokeWidth={2.5}
        strokeDasharray="8 8"
        strokeLinecap="round"
        fill="none"
      />
      <Pin x={70} y={128} color={t.pinA} ring={t.skyBottom} />
      <Pin x={318} y={80} color={t.pinB} ring="#FFFFFF" />
      {showScooter ? <Scooter x={172} y={106} box={t.pinB} /> : null}
    </Svg>
  );
}

/** Square spot illustration for empty states: an open parcel on a soft disc. */
export function EmptyParcelArt({ size = 120, tint = colors.primary }: { size?: number; tint?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx={60} cy={62} r={50} fill={colors.langit} />
      <Circle cx={96} cy={26} r={6} fill={colors.kunyit} />
      <Circle cx={22} cy={40} r={4} fill={colors.senja} />
      <Ellipse cx={60} cy={98} rx={30} ry={5} fill={colors.laut} opacity={0.12} />
      {/* Box body */}
      <Path d="M30 56 L60 68 L90 56 L90 88 L60 100 L30 88 Z" fill="#E9A85B" />
      <Path d="M60 68 L90 56 L90 88 L60 100 Z" fill="#D18C3F" />
      {/* Flaps */}
      <Path d="M30 56 L60 44 L90 56 L60 68 Z" fill="#F6C98C" />
      <Path d="M30 56 L18 46 L48 34 L60 44 Z" fill="#F2BC74" />
      <Path d="M90 56 L102 46 L72 34 L60 44 Z" fill="#E3A65C" />
      {/* Tape */}
      <Path d="M44 62 L44 94 L50 96.5 L50 64.5 Z" fill={tint} opacity={0.85} />
    </Svg>
  );
}

/** Small round badge art for success moments (handover done, payment done). */
export function SuccessBurstArt({ size = 120, tint = colors.sawah }: { size?: number; tint?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx={60} cy={60} r={52} fill={tint} opacity={0.12} />
      <Circle cx={60} cy={60} r={36} fill={tint} />
      <Path d="M44 61 L55 72 L77 49" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={20} cy={36} r={5} fill={colors.kunyit} />
      <Circle cx={100} cy={30} r={4} fill={colors.senja} />
      <Circle cx={104} cy={84} r={6} fill={colors.primary} />
      <Circle cx={18} cy={88} r={3.5} fill={colors.primary} />
      <Path d="M92 12 L94 18 L100 20 L94 22 L92 28 L90 22 L84 20 L90 18 Z" fill={colors.kunyit} />
    </Svg>
  );
}

/** Folded map with a dashed route between two pins — empty route lists, "no driver yet". */
export function RouteMapArt({ size = 120, tint = colors.sawah }: { size?: number; tint?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx={60} cy={62} r={50} fill={tint} opacity={0.12} />
      <Ellipse cx={60} cy={100} rx={34} ry={5} fill={colors.laut} opacity={0.1} />
      {/* three map panels */}
      <Path d="M22 36 L46 28 L46 88 L22 96 Z" fill="#FFFFFF" />
      <Path d="M46 28 L74 36 L74 96 L46 88 Z" fill="#EEF4FF" />
      <Path d="M74 36 L98 28 L98 88 L74 96 Z" fill="#FFFFFF" />
      <Path d="M22 36 L46 28 L74 36 L98 28 L98 88 L74 96 L46 88 L22 96 Z" fill="none" stroke={colors.border} strokeWidth={1.5} strokeLinejoin="round" />
      {/* route */}
      <Path d="M32 80 C 44 70, 52 74, 60 62 S 78 46, 88 44" stroke={tint} strokeWidth={3.5} strokeDasharray="5 5" strokeLinecap="round" fill="none" />
      <Circle cx={32} cy={80} r={5} fill={colors.primary} stroke="#FFFFFF" strokeWidth={2} />
      <Path d="M88 44 C 80 34, 80 26, 88 24 C 96 26, 96 34, 88 44 Z" fill={colors.senja} />
      <Circle cx={88} cy={31} r={3} fill="#FFFFFF" />
      <Circle cx={104} cy={22} r={4} fill={colors.kunyit} />
    </Svg>
  );
}

/** Bell with a little notification dot — empty notification list. */
export function BellArt({ size = 120 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx={60} cy={62} r={50} fill={colors.langit} />
      <Ellipse cx={60} cy={100} rx={26} ry={4} fill={colors.laut} opacity={0.1} />
      <Path d="M60 30 C 44 30, 38 44, 38 58 L 38 72 L 32 80 L 88 80 L 82 72 L 82 58 C 82 44, 76 30, 60 30 Z" fill={colors.kunyit} />
      <Path d="M60 30 C 70 30, 76 38, 78 48" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.6} />
      <Rect x={30} y={78} width={60} height={6} rx={3} fill="#E3A81F" />
      <Circle cx={60} cy={90} r={6} fill="#E3A81F" />
      <Circle cx={84} cy={34} r={8} fill={colors.senja} stroke="#FFFFFF" strokeWidth={3} />
      <Path d="M20 50 Q 14 58 20 66" stroke={colors.primary} strokeWidth={3} strokeLinecap="round" fill="none" />
      <Path d="M100 50 Q 106 58 100 66" stroke={colors.primary} strokeWidth={3} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/** Two speech bubbles — empty chat. */
export function ChatArt({ size = 120 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx={60} cy={62} r={50} fill={colors.langit} />
      <Path d="M22 40 Q22 30 32 30 L70 30 Q80 30 80 40 L80 58 Q80 68 70 68 L40 68 L28 78 L30 68 Q22 66 22 58 Z" fill="#FFFFFF" />
      <Circle cx={38} cy={49} r={3.5} fill={colors.text.muted} />
      <Circle cx={51} cy={49} r={3.5} fill={colors.text.muted} />
      <Circle cx={64} cy={49} r={3.5} fill={colors.text.muted} />
      <Path d="M50 62 Q50 54 58 54 L90 54 Q98 54 98 62 L98 78 Q98 86 90 86 L88 86 L90 96 L78 86 L58 86 Q50 86 50 78 Z" fill={colors.primary} />
      <Path d="M62 70 L86 70 M62 77 L78 77" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

/** One hand passing a parcel to another, with a 4-digit code bubble — handover moments. */
export function HandoverArt({ width = 160, height = 110 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 160 110">
      <Ellipse cx={80} cy={100} rx={56} ry={6} fill={colors.laut} opacity={0.1} />
      {/* left arm (driver, blue sleeve) */}
      <Path d="M0 74 L40 66 Q48 64 52 70 L56 78 L2 92 Z" fill={colors.primary} />
      <Path d="M50 64 Q58 58 66 62 L70 70 Q64 76 56 76 Z" fill="#E9B48A" />
      {/* right arm (recipient, coral sleeve) */}
      <Path d="M160 74 L120 66 Q112 64 108 70 L104 78 L158 92 Z" fill={colors.senja} />
      <Path d="M110 64 Q102 58 94 62 L90 70 Q96 76 104 76 Z" fill="#C98D63" />
      {/* parcel */}
      <Path d="M58 46 L80 38 L102 46 L102 70 L80 78 L58 70 Z" fill="#E9A85B" />
      <Path d="M80 54 L102 46 L102 70 L80 78 Z" fill="#D18C3F" />
      <Path d="M58 46 L80 38 L102 46 L80 54 Z" fill="#F6C98C" />
      <Path d="M68 42 L90 50 L90 58 L68 50 Z" fill={colors.kunyit} opacity={0.9} />
      {/* code bubble */}
      <Rect x={56} y={4} width={48} height={22} rx={11} fill="#FFFFFF" stroke={colors.langit} strokeWidth={2} />
      <Circle cx={68} cy={15} r={3} fill={colors.laut} />
      <Circle cx={76} cy={15} r={3} fill={colors.laut} />
      <Circle cx={84} cy={15} r={3} fill={colors.laut} />
      <Circle cx={92} cy={15} r={3} fill={colors.laut} />
      <Path d="M76 26 L80 32 L84 26 Z" fill="#FFFFFF" />
      <Path d="M18 26 L20 32 L26 34 L20 36 L18 42 L16 36 L10 34 L16 32 Z" fill={colors.kunyit} />
      <Circle cx={142} cy={30} r={4} fill={colors.sawah} />
    </Svg>
  );
}

/** Scooter on a short road inside a soft circle — "looking for a driver". */
export function SearchingArt({ size = 140 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 140 140">
      <Circle cx={70} cy={70} r={56} fill={colors.langit} />
      <Path d="M20 96 Q 70 80 120 96" stroke="#FFFFFF" strokeWidth={14} strokeLinecap="round" fill="none" />
      <Path d="M20 96 Q 70 80 120 96" stroke={colors.kunyit} strokeWidth={2.5} strokeDasharray="7 7" strokeLinecap="round" fill="none" />
      <G transform="translate(52 88) scale(1.25)">
        <Rect x={-2} y={-22} width={13} height={11} rx={2.5} fill={colors.senja} />
        <Path d="M 0 -10 L 22 -10 L 27 -20 L 30 -20 L 25 -6 L 2 -6 Z" fill={colors.primary} />
        <Circle cx={22} cy={-26} r={4.5} fill={colors.kunyit} />
        <Path d="M 18 -21 L 26 -21 L 24 -12 L 16 -12 Z" fill={colors.laut} />
        <Circle cx={4} cy={-3} r={5} fill={colors.laut} />
        <Circle cx={4} cy={-3} r={2} fill="#FFFFFF" />
        <Circle cx={26} cy={-3} r={5} fill={colors.laut} />
        <Circle cx={26} cy={-3} r={2} fill="#FFFFFF" />
      </G>
      <Path d="M34 46 L52 46 M28 54 L44 54" stroke={colors.primary} strokeWidth={3} strokeLinecap="round" opacity={0.5} />
    </Svg>
  );
}
