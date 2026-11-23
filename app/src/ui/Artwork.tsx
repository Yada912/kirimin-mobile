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
