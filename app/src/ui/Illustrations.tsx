import React from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Rect,
  Stop,
  G,
  Line,
} from 'react-native-svg';

interface ArtProps {
  width?: number;
  height?: number;
}

/**
 * Playful scooter commuter delivering a golden parcel along a Bali coastal road.
 * Used on the Kirim (Sender) Hero Banner.
 */
export function CourierScooterArt({ width = 128, height = 104 }: ArtProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 140 112" fill="none">
      <Defs>
        <LinearGradient id="sunGlow" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FDE047" />
          <Stop offset="1" stopColor="#FB923C" />
        </LinearGradient>
        <LinearGradient id="scooterBody" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#38BDF8" />
          <Stop offset="1" stopColor="#FFFFFF" />
        </LinearGradient>
        <LinearGradient id="boxGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FBBF24" />
          <Stop offset="1" stopColor="#F59E0B" />
        </LinearGradient>
      </Defs>

      {/* Soft floating halo & Bali sun */}
      <Circle cx="106" cy="24" r="18" fill="url(#sunGlow)" opacity="0.92" />
      <Circle cx="106" cy="24" r="24" fill="#FDE047" opacity="0.2" />

      {/* Decorative palm / hill silhouette */}
      <Path
        d="M12 88 Q36 56 68 78 T132 82 L132 104 L12 104 Z"
        fill="#FFFFFF"
        opacity="0.14"
      />

      {/* Road strip & speed lines */}
      <Rect x="10" y="92" width="120" height="8" rx="4" fill="#0F172A" opacity="0.22" />
      <Line x1="16" y1="74" x2="36" y2="74" stroke="#93C5FD" strokeWidth="3" strokeLinecap="round" />
      <Line x1="8" y1="82" x2="26" y2="82" stroke="#FDE047" strokeWidth="2.5" strokeLinecap="round" />

      {/* Delivery Parcel Box on rear rack */}
      <G>
        <Rect x="28" y="42" width="28" height="24" rx="5" fill="url(#boxGrad)" stroke="#FFFFFF" strokeWidth="2" />
        <Line x1="42" y1="42" x2="42" y2="66" stroke="#FEF3C7" strokeWidth="3" />
        <Path d="M36 48 L48 48" stroke="#92400E" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      </G>

      {/* Scooter Frame */}
      <Path
        d="M36 74 L78 74 L92 52 L106 52 L112 78 L92 84 L42 84 Z"
        fill="url(#scooterBody)"
      />
      {/* Seat */}
      <Rect x="54" y="56" width="24" height="8" rx="4" fill="#1E293B" />
      {/* Handlebar & Headlight */}
      <Path d="M90 52 L96 36 L108 36" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="110" cy="48" r="5" fill="#FEF08A" />

      {/* Friendly Rider Helmet */}
      <Circle cx="76" cy="36" r="11" fill="#F97316" stroke="#FFFFFF" strokeWidth="2" />
      <Path d="M78 32 Q86 32 86 38 L78 38 Z" fill="#1E293B" />
      {/* Rider Torso */}
      <Path d="M68 48 Q78 46 84 56 L72 62 Z" fill="#34D399" />

      {/* Wheels */}
      <Circle cx="46" cy="86" r="11" fill="#0F172A" stroke="#FFFFFF" strokeWidth="3" />
      <Circle cx="46" cy="86" r="4" fill="#CBD5E1" />
      <Circle cx="102" cy="86" r="11" fill="#0F172A" stroke="#FFFFFF" strokeWidth="3" />
      <Circle cx="102" cy="86" r="4" fill="#CBD5E1" />

      {/* Sparkles */}
      <Circle cx="24" cy="26" r="3" fill="#FEF08A" />
      <Circle cx="54" cy="20" r="2" fill="#FFFFFF" opacity="0.8" />
    </Svg>
  );
}

/**
 * Colorful route navigation & earnings art for the Angkut (Driver) Hero Banner.
 */
export function DriverRouteArt({ width = 128, height = 104 }: ArtProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 140 112" fill="none">
      <Defs>
        <LinearGradient id="mapCard" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.28" />
          <Stop offset="1" stopColor="#A7F3D0" stopOpacity="0.16" />
        </LinearGradient>
        <LinearGradient id="coinGold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FDE047" />
          <Stop offset="1" stopColor="#F59E0B" />
        </LinearGradient>
      </Defs>

      {/* Stylized floating mini map tile */}
      <Rect x="16" y="16" width="108" height="80" rx="16" fill="url(#mapCard)" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="1.5" />

      {/* Road grid lines */}
      <Path d="M26 78 C46 72, 54 44, 76 46 C96 48, 100 28, 114 30" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="10" strokeLinecap="round" />
      {/* Active Navigation Route */}
      <Path d="M26 78 C46 72, 54 44, 76 46 C96 48, 100 28, 114 30" stroke="#34D399" strokeWidth="5" strokeLinecap="round" />

      {/* Start Pin */}
      <Circle cx="28" cy="77" r="7" fill="#FFFFFF" />
      <Circle cx="28" cy="77" r="4" fill="#1463F3" />

      {/* Destination Pin */}
      <Path d="M112 16 C106 16 102 20 102 26 C102 33 112 42 112 42 C112 42 122 33 122 26 C122 20 118 16 112 16 Z" fill="#F97316" stroke="#FFFFFF" strokeWidth="2" />
      <Circle cx="112" cy="25" r="3.5" fill="#FFFFFF" />

      {/* Driver Navigation Chevron Puck */}
      <G>
        <Circle cx="74" cy="46" r="13" fill="#34D399" opacity="0.32" />
        <Circle cx="74" cy="46" r="9" fill="#FFFFFF" />
        <Path d="M74 40 L79 50 L74 47.5 L69 50 Z" fill="#059669" />
      </G>

      {/* Floating Rupiah / Coin Badge */}
      <Circle cx="110" cy="82" r="14" fill="url(#coinGold)" stroke="#FFFFFF" strokeWidth="2.5" />
      <Path d="M106 82 L110 78 L114 82 L110 86 Z" fill="#FFFFFF" />

      {/* Floating Sparkles */}
      <Circle cx="34" cy="30" r="3" fill="#FDE047" />
      <Circle cx="52" cy="24" r="2" fill="#FFFFFF" opacity="0.85" />
    </Svg>
  );
}

/**
 * Large colorful hero illustration for Welcome / Onboarding screen.
 */
export function WelcomeHeroArt({ width = 320, height = 164 }: ArtProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 340 176" fill="none">
      <Defs>
        <LinearGradient id="skyBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#1463F3" />
          <Stop offset="0.55" stopColor="#2563EB" />
          <Stop offset="1" stopColor="#0D9488" />
        </LinearGradient>
        <LinearGradient id="baliSun" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FEF08A" />
          <Stop offset="1" stopColor="#FB923C" />
        </LinearGradient>
      </Defs>

      {/* Rounded vibrant backdrop */}
      <Rect x="0" y="0" width="340" height="176" rx="24" fill="url(#skyBg)" />

      {/* Soft clouds & sun */}
      <Circle cx="282" cy="40" r="24" fill="url(#baliSun)" />
      <Circle cx="282" cy="40" r="34" fill="#FEF08A" opacity="0.16" />
      <Ellipse cx="68" cy="36" rx="28" ry="10" fill="#FFFFFF" opacity="0.14" />
      <Ellipse cx="204" cy="28" rx="22" ry="8" fill="#FFFFFF" opacity="0.12" />

      {/* Bali Bukit hills */}
      <Path d="M0 132 Q62 82 142 114 T340 104 L340 176 L0 176 Z" fill="#0F172A" opacity="0.18" />
      <Path d="M0 144 Q98 110 194 134 T340 124 L340 176 L0 176 Z" fill="#FFFFFF" opacity="0.12" />

      {/* Glowing Winding Route across Bali */}
      <Path
        d="M36 138 C86 138, 108 86, 170 92 C230 98, 250 134, 304 112"
        stroke="#FFFFFF"
        strokeOpacity="0.32"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <Path
        d="M36 138 C86 138, 108 86, 170 92 C230 98, 250 134, 304 112"
        stroke="#FDE047"
        strokeWidth="4"
        strokeDasharray="8 8"
        strokeLinecap="round"
      />

      {/* Origin Pin (Denpasar) */}
      <G>
        <Circle cx="42" cy="136" r="12" fill="#FFFFFF" />
        <Circle cx="42" cy="136" r="6" fill="#1463F3" />
      </G>

      {/* Center Scooter + Parcel Hero */}
      <G transform="translate(118, 42)">
        <Rect x="10" y="22" width="26" height="22" rx="5" fill="#FBBF24" stroke="#FFFFFF" strokeWidth="2" />
        <Line x1="23" y1="22" x2="23" y2="44" stroke="#FEF3C7" strokeWidth="3" />
        <Path d="M18 52 L60 52 L72 34 L86 34 L90 56 L70 62 L24 62 Z" fill="#FFFFFF" />
        <Rect x="36" y="36" width="22" height="7" rx="3.5" fill="#1E293B" />
        <Path d="M70 34 L76 20 L86 20" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
        <Circle cx="58" cy="18" r="10" fill="#F97316" stroke="#FFFFFF" strokeWidth="2" />
        <Path d="M60 14 Q67 14 67 20 L60 20 Z" fill="#1E293B" />
        <Path d="M50 30 Q58 28 64 38 L53 42 Z" fill="#34D399" />
        <Circle cx="28" cy="64" r="10" fill="#0F172A" stroke="#FFFFFF" strokeWidth="3" />
        <Circle cx="80" cy="64" r="10" fill="#0F172A" stroke="#FFFFFF" strokeWidth="3" />
      </G>

      {/* Destination Pin (Bukit) */}
      <G>
        <Path
          d="M302 82 C294 82 288 88 288 96 C288 106 302 118 302 118 C302 118 316 106 316 96 C316 88 310 82 302 82 Z"
          fill="#34D399"
          stroke="#FFFFFF"
          strokeWidth="2.5"
        />
        <Circle cx="302" cy="95" r="5" fill="#FFFFFF" />
      </G>

      {/* Floating confetti dots */}
      <Circle cx="94" cy="52" r="4" fill="#FDE047" />
      <Circle cx="238" cy="66" r="3.5" fill="#A7F3D0" />
      <Circle cx="152" cy="30" r="3" fill="#FFFFFF" opacity="0.7" />
    </Svg>
  );
}

/**
 * Playful security shield & package handover illustration.
 */
export function HandoverSparkArt({ width = 76, height = 76 }: ArtProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 80 80" fill="none">
      <Circle cx="40" cy="40" r="36" fill="#DCFCE7" />
      <Circle cx="40" cy="40" r="28" fill="#BBF7D0" />
      <Path
        d="M40 16 L58 23 V39 C58 51 50 60 40 64 C30 60 22 51 22 39 V23 L40 16 Z"
        fill="#059669"
        stroke="#FFFFFF"
        strokeWidth="2.5"
      />
      <Path
        d="M32 40 L37.5 45.5 L49 34"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="65" cy="18" r="4" fill="#F59E0B" />
      <Circle cx="15" cy="24" r="3" fill="#1463F3" />
    </Svg>
  );
}
